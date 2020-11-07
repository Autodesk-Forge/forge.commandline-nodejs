//
// Copyright (c) 2019 Autodesk, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// by Cyrille Fauvel
// Autodesk Forge Partner Development
//
/*jshint esversion: 6 */

const express = require('express');
const ws = require('ws');
const _fs = require('fs');
const _path = require('path');
const utils = require('../api/utils');
const CDNS = require('./cdn-registry');

const SERVER_PORT = /*process.env.PORT ||*/ 7125;
const MODEL_SERVER_PORT = SERVER_PORT - 1;
CDNS.repositories = _path.resolve(process.env.REPOS || process.argv[2] || process.cwd());

let app = express();
//app.use(bodyParser.json());
//app.use(express.static(_path.resolve(_path.join(__dirname, '..'))));
app.set('port', SERVER_PORT || 80);

app.use((req, res, next) => { // eslint-disable-line no-unused-vars
	let queryString = decodeURIComponent(req.path);
	queryString = queryString.replace('//', '/');
	//console.log(req.method, queryString);

	if (req.method === 'OPTIONS')
		return (res.status(200).end());
	if (queryString.indexOf('cdnws') !== -1)
		return (console.info('cdnws'), next());
	if (queryString.endsWith('.js.map')) {
		utils.fileexists()
			.then((val) => {
				if (val === false)
					return (res.status(404).end());
				res.sendFile(_path.resolve(_path.join(CDNS.repositories, queryString)));
			})
			.catch((err) => { // eslint-disable-line no-unused-vars
				res.status(404).end();
			});
		return;
	}

	let split = queryString.split('/');

	// Getting main manifest
	if (queryString.endsWith('/bubble.json')) {
		try {
			// Read the manifest file synchronously - not the best thing to do, but no choice!
			if (queryString.startsWith('/modeldata/manifest'))
				queryString =queryString.substring('/modeldata/manifest'.length);
			let json = _fs.readFileSync(_path.join(CDNS.repositories, queryString), 'utf8');
			json = JSON.parse(json);
			let otg_manifest = json.children.filter((elt) => { return (elt.role === 'viewable' && elt.otg_manifest); });
			if (otg_manifest.length !== 1)
				return (res.status(422).end());
			otg_manifest = otg_manifest[0].otg_manifest;
			let accountid = otg_manifest.paths.global_root.split('/')[1];
			let refid = otg_manifest.paths.shared_root.split('/')[1];
			CDNS.buildCDNS(split[1], accountid, refid, json.urn);
		} catch (error) {
			return (res.status(422).end());
		}
		return (res.sendFile(_path.join(CDNS.repositories, queryString)));
	}


	// Getting View Manifest
	if (queryString.endsWith('/otg_model.json')) {
		let cdn = CDNS.buildCDN(split[4], split.slice(-6).join('/'));
		let st = split.slice(5).join('/');
		let filename = _path.resolve(_path.join(cdn.repopath, cdn.root, st));
		res.sendFile(filename);
		return;
	}

	if (queryString.indexOf('urn:adsk.fluent') !== -1) {
		let cdn = CDNS.buildCDN(split[4], split.slice(-6).join('/'));
		let st = split.slice(-6);
		if (split.length === 11)
			queryString = _path.join(cdn.root, st.join('/'));
		else if (split.length === 7)
			queryString = _path.join(cdn.root, 'pdb', split[6]);
		else if (split.length === 9)
			queryString = _path.join(cdn.root, split[5], split[6], split[7], split[8]);
	} else if (queryString.indexOf('/cdn/') === 0) {
		let cdn = CDNS.get(split[3]);
		queryString = _path.join(cdn.root, 'cdn', split[4], split[2], split[5]);
	}
	return (res.sendFile(_path.resolve(_path.join(CDNS.repositories, queryString))));
});

// WEB Socket implementation
const WS_SERVER_PORT = MODEL_SERVER_PORT;
let activeSockets = [];
// Response messages smaller than this will be batched when batching is turned on
const SMALL_MESSAGE_SIZE = 1000; // eslint-disable-line no-unused-vars
const MINUTE = 60000;
const SOCKET_IDLE_TIMEOUT = 1 * MINUTE;

const wss = new ws.Server({ port: WS_SERVER_PORT, perMessageDeflate: false });

function sendBatch (ows, items, resourceType) {
	if (!items.length)
		return;
	// Construct a batch response message.
	/*
		The format is as follows:

		Bytes      Meaning
		------------------------------
		0-3        Magic number. The bytes 'OPK1'
		4-7        Currently unused flags + resource type (ASCII 'm' or 'g') in byte 0 of this integer.
		8-11       Number of items in the message stream. Little endian.
		12-15      Offset of the first item in the data buffer (first item is implicitly at offset 0, so this is always zero)
		16-19      Offset of the second item in the data buffer
		20-...     etc... subsequent offsets, one per item
		...
		Remaining bytes: all items combined into single buffer
	*/
	const prefixLength = 12;
	let headerLength = prefixLength + 4 * items.length;
	let header = Buffer.allocUnsafe(headerLength);
	header.writeInt32LE(0x314B504F, 0); //OPK1
	header.writeInt32LE(resourceType.charCodeAt(0) & 0xff, 4);
	header.writeInt32LE(items.length, 8);

	if ( items.length > 1 )
		console.log (items.length);
	let offset = 0;
	for (let i = 0; i < items.length; i++) {
		if (resourceType === 'g' && offset % 4 !== 0)
			console.error(`wrong offset ${i}`);
		header.writeInt32LE(offset, prefixLength + i * 4);
		offset += items[i].length;
	}

	ows.txMessageCount += items.length;

	items.unshift(header);

	let toSend = Buffer.concat(items, headerLength + offset);
	//console.log(` ==> sendBatch tx:${ows.txMessageCount}`);
	ows.send(toSend, (err) => {
		if (err)
			console.error(`Socket send error. ${err}`);
	});
}

function queueItemForSend (ows, data, resourceType) {
	//if (data.length > SMALL_MESSAGE_SIZE) {
		sendBatch(ows, [data], resourceType); // eslint-disable-line indent
	// } else {
	// 	// Group the pending items by resource type, because
	// 	// we can't mix resource types in a message batch
	// 	if (!ows.pendingSends[resourceType])
	// 		ows.pendingSends[resourceType] = [];
	// 	ows.pendingSends[resourceType].push(data);
	// }
}

// Gets CDN resource from S3, then writes it into the web socket (and also remembers in local memory cache)
function proxyResource (path, ows) {
	let split = path.split('/');
	let hash = split[0] + split[3];
	let accountPrefix = split[1];
	let resourceType = split[2]; // can be 'm' for material, 'g' for geometry, or 't' for texture
	let binhash = Buffer.from(hash, 'hex');

	// console.log (binhash) ;
	// console.log (split);
	if (!ows.cdn)
		ows.cdn = CDNS.get(accountPrefix);

	let st = _path.resolve(_path.join(ows.cdn[resourceType], split[0], split[3]));
	//console.log(`-> cdnws - ${resourceType} ${split[0]} ${split[3]}`);

	utils.readFile(st/*, 'binary'*/)
		.then((data) => {
			let combined = Buffer.concat([binhash, data]);
			if (resourceType === 'g' && (data.length % 4 !== 0 || binhash.length % 4 !== 0)) {
				let missing = combined.length + 4 - (combined.length % 4);
				let combined2 = Buffer.alloc(missing, 0);
				combined.copy(combined2, 0, 0);
				combined = combined2;
				//console.log (`${st}}`);
			}
			if (ows.readyState === 1) {
				ows.timestamp = Date.now();
				if (ows.clientOptions.batch_responses) {
					queueItemForSend(ows, combined, resourceType);
				} else {
					ows.txMessageCount++;
					//console.log(` ==> sendOne tx:${ows.txMessageCount}`);
					ows.send(combined, (err) => {
						if (err)
							console.error(`Socket send error. ${err}`);
					});
				}
			}
		})
		.catch((err) => {
			console.error(`Failed to get resource. ${JSON.stringify(err)}`);
			ows.errorCount++;
			if (ws.readyState === 1)
				ows.send(binhash);
		});

	// let data =_fs.readFileSync (st) ;
	// let combined = Buffer.concat([binhash, data]);
	// if (ows.readyState === 1) {
	// 	ows.timestamp = Date.now();
	// 	if (ows.clientOptions.batch_responses) {
	// 		queueItemForSend(ows, combined, resourceType);
	// 	} else {
	// 		otxMessageCount++;
	// 		//console.log(` ==> sendOne tx:${ows.txMessageCount}`);
	// 		ows.send(combined, (err) => {
	// 			if (err)
	// 				console.error(`Socket send error. ${err}`);
	// 		});
	// 	}
	// }
}

wss.on('connection', (ows, req) => { // eslint-disable-line no-unused-vars
	ows.rxMessageCount = 0;
	ows.txMessageCount = 0;
	ows.clientOptions = {
		batch_responses: false, //off by default for backwards compatibility, until all clients are updated
		pack_version: 1, //stream format version for batched responses
	};
	ows.pendingSends = {};

	activeSockets.push(ows);
	//console.log(`Socket open. Active: ${activeSockets.length}`);

	ows.on('message', function incoming (message) {
		ows.timestamp = Date.now();

		if (typeof message === 'string') {
			//console.log(`-> message ${message}`);

			if (message.startsWith('/cdn/'))
				message = message.slice(5);
			if (message.startsWith('/auth/')) { // eslint-disable-line no-empty
			} else if (message.startsWith('/headers/')) { // eslint-disable-line no-empty
			} else if (message.startsWith('/account_id/')) {
				// Sets an account ID prefix to be used for all 
				// subsequent compact binary message requests.
				ows.accountPrefixBinary = message.slice('/account_id/'.length);
				ows.cdn = CDNS.get(ows.accountPrefixBinary);
			} else if (message.startsWith('/options/')) {
				// An object containing options for how responses are sent to the client
				let options = message.slice('/options/'.length);
				try {
					let parsed = JSON.parse(options);
					ows.clientOptions = parsed || {};
				} catch (e) {
					ows.errorCount++;
				}
			} else if (message.startsWith('/')) {
				ows.errorCount++;
			} else {
				ows.rxMessageCount++;
				proxyResource(message, ows);
			}
		} else {
			let resourceType = String.fromCharCode(message[0]);
			for (let i = 1; i < message.length; i += 20) {
				ows.rxMessageCount++;
				let resourceHash = message.slice(i, i + 20).toString('hex');
				let accountId = ows.accountPrefixBinary;
				// TODO: proxyResource can be refactored a bit so we don't have
				// to concat the string here only to split it again immediately after.
				let path = resourceHash.slice(0, 4) + '/' + accountId + '/' + resourceType + '/' + resourceHash.slice(4);
				//console.log(` binary ${path}`);
				proxyResource(path, ows);
			}
		}

	});

	ows.on('close', function close () {
		let idx = activeSockets.indexOf(ows);
		if (idx >= 0)
			activeSockets.splice(idx, 1);
		//console.log(`Socket closed. Active: ${activeSockets.length}`);
	});

	ows.on('error', function error (err) {
		console.error(`Socket error: ${err}`);
		let idx = activeSockets.indexOf(ows);
		if (idx >= 0)
			activeSockets.splice(idx, 1);
	});

});

// Periodically send batched messages
setInterval(() => {
	for (let i = 0; i < activeSockets.length; i++) {
		let ows = activeSockets[i];
		for (let resourceType in ows.pendingSends) {
			sendBatch(ows, ows.pendingSends[resourceType], resourceType);
			ows.pendingSends[resourceType] = [];
		}
	}
}, 100);

// Periodically close inactive sockets
setInterval(() => {
	let now = Date.now();

	// This loop is potentially quadratic time, if each socket gets closed
	for (let i = 0; i < activeSockets.length; i++) {
		let ows = activeSockets[i];
		console.log(`wsac:${ows.accountPrefixBinary}, rx:${ows.rxMessageCount}, tx:${ows.txMessageCount}`);
		if (now - ows.timestamp > SOCKET_IDLE_TIMEOUT) {
			// Note: 1000 is a standard WebSocket close code.
			ows.close(1000, 'idle timeout');
		}
		if (ows.errorCount > 100) {
			ows.close(1008, 'too many errors');
		}
	}
}, 1 * MINUTE);

// Launch Server now!
let server = app.listen(app.get('port'), () => {
	console.log('API key ' + process.env.FORGE_CLIENT_ID);
	console.log('Server listening on port ' + server.address().port);
});

server.on('error', (err) => {
	if (err.errno === 'EACCES') {
		console.log('Port ' + app.get('port') + ' already in use.\nExiting...');
		process.exit(1);
	}
});
