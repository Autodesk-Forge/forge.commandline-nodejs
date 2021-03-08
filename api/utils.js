//
// Copyright (c) 2016 Autodesk, Inc.
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

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class utils {

	static clearUrn (urn) {
		urn = urn.replace('urn:', '');
		return (urn);
	}

	static safeUrnEncode (urn, padding) { // eslint-disable-line no-unused-vars
		padding = (padding === undefined ? true : padding);
		urn = urn.replace('urn:', '').replace(/\+/g, '-').replace(/=/g, '_');
		while ((urn.length % 4) !== 0)
			urn += '_';
		return (urn);
	}

	static safeUrnDecode (urn) {
		urn = urn.replace(/-/g, '+').replace(/_/g, '=');
		return (urn);
	}

	static getVersion (versionId) {
		let results = versionId.match(/^urn:(.+)\?version=(\d+)$/);
		if (!results || results.length !== 3)
			return (1);
		return (results[2]);
	}

	static path (pathname, closingSlash) {
		closingSlash = closingSlash || '/';
		return (path.normalize(path.join(__dirname, '/../', pathname)) + closingSlash);
	}

	static dataPath (pathname, closingSlash) {
		closingSlash = closingSlash || '/';
		return (path.normalize(path.join(__dirname, '/../data/', pathname)) + closingSlash);
	}

	static data (name, ext) {
		ext = ext || '.json';
		return (path.normalize(path.join(__dirname, '/../data/', name) + ext));
	}

	static readFile (filename, enc) {
		return (new Promise((fulfill, reject) => {
			fs.readFile(filename, enc, (err, res) => {
				if (err)
					reject(err);
				else
					fulfill(res);
			});
		}));
	}

	static writeFile (filename, content, enc, bRaw) {
		return (new Promise((fulfill, reject) => {
			let pathname = path.dirname(filename);
			mkdirp(pathname)
				.then((_pathname) => { // eslint-disable-line no-unused-vars
					fs.writeFile(filename, !bRaw && typeof content !== 'string' ? JSON.stringify(content) : content, enc, (err) => {
						if (err)
							reject(err);
						else
							fulfill(content);
					});
				});
		}));
	}

	static json (name) {
		let filename = utils.data(name, '.json');
		return (new Promise((fulfill, reject) => {
			utils.readFile(filename, 'utf8')
				.then((res) => {
					try {
						fulfill(JSON.parse(res));
					} catch (ex) {
						console.error(ex.message, name);
						reject(ex);
					}
				}, reject);
		}));
	}

	static jsonRoot (name) {
		let filename = path.normalize(name);
		return (new Promise((fulfill, reject) => {
			utils.readFile(filename, 'utf8')
				.then((res) => {
					try {
						fulfill(JSON.parse(res));
					} catch (ex) {
						console.error(ex.message, name);
						reject(ex);
					}
				}, reject);
		})
		);
	}

	static jsonGzRoot (name) {
		let filename = path.normalize(name);
		return (new Promise((fulfill, reject) => {
			utils.readFile(filename)
				.then((res) => {
					zlib.gunzip(res, (err, dezipped) => {
						try {
							fulfill(JSON.parse(dezipped.toString('utf-8')));
						} catch (ex) {
							console.error(ex.message, name);
							reject(ex);
						}
					});
				}, reject);
		})
		);
	}

	static gunzip (res, bRaw = false) {
		return (new Promise((fulfill, reject) => {
			zlib.gunzip(res, (err, dezipped) => {
				if (err) {
					console.error(err);
					return (reject(err));
				}
				try {
					if (bRaw)
						fulfill(dezipped);
					else
						fulfill(JSON.parse(dezipped.toString('utf-8')));
				} catch (ex) {
					fulfill(dezipped);
				}
			});
		}));
	}

	static filesize (filename) {
		return (new Promise((fulfill, reject) => {
			fs.stat(filename, (err, stat) => {
				if (err)
					reject(err);
				else
					fulfill(stat.size);
			});
		}));
	}

	static fileexists (filename) {
		return (new Promise((fulfill, reject) => {
			fs.stat(filename, (err, stat) => { // eslint-disable-line no-unused-vars
				if (err) {
					if (err.code === 'ENOENT')
						fulfill(false);
					else
						reject(err);
				} else {
					fulfill(true);
				}
			});
		}));
	}

	static findFiles (dir, filter) {
		return (new Promise((fulfill, reject) => {
			fs.readdir(dir, (err, files) => {
				if (err) {
					reject(err);
					return;
				}
				if (filter !== undefined && typeof filter === 'string')
					files = files.filter((file) => { return (path.extname(file) === filter); });
				else if (filter !== undefined && typeof filter === 'object')
					files = files.filter((file) => { return (filter.test(file)); });
				fulfill(files);
			});
		}));
	}

	static walkDirs (dir, done) {
		let results = [];
		fs.readdir(dir, (err, list) => {
			if (err)
				return (done(err));
			let pending = list.length;
			if (!pending)
				return (done(null, results));
			list.forEach((file) => {
				file = path.resolve(dir, file);
				fs.stat(file, (err2, stat) => {
					if (stat && stat.isDirectory()) {
						utils.walkDirs(file, (err3, res) => {
							results = results.concat(res);
							if (!--pending)
								done(null, results);
						});
					} else {
						results.push(file);
						if (!--pending)
							done(null, results);
					}
				});
			});
		});
	}

	static findFilesRecursive (dir, filter) {
		return (new Promise((fulfill, reject) => {
			utils.walkDirs(dir, (err, results) => {
				if (err)
					return (reject(err));
				results = results.map((file) => { return (file.substring(dir.length)); });
				if (filter !== undefined && typeof filter === 'string')
					results = results.filter((file) => { return (path.extname(file) === filter); });
				else if (filter !== undefined && typeof filter === 'object')
					results = results.filter((file) => { return (filter.test(file)); });
				fulfill(results);
			});
		}));
	}

	static unlink (filename) {
		return (new Promise((fulfill, reject) => {
			fs.stat(filename, (err, stat) => { // eslint-disable-line no-unused-vars
				if (err) {
					if (err.code === 'ENOENT')
						fulfill(false);
					else
						reject(err);
				} else {
					fs.unlink(filename, (err2) => {}); // eslint-disable-line no-unused-vars
					fulfill(true);
				}
			});
		}));
	}

	static mv (oldname, newname) {
		return (new Promise((fulfill, reject) => {
			fs.stat(oldname, (err, stat) => { // eslint-disable-line no-unused-vars
				if (err) {
					if (err.code === 'ENOENT')
						fulfill(false);
					else
						reject(err);
				} else {
					fs.rename(oldname, newname, (err2) => {}); // eslint-disable-line no-unused-vars
					fulfill(true);
				}
			});
		}));
	}

	static isCompressed (filename) {
		return (path.extname(filename).toLowerCase() === '.zip'
			|| path.extname(filename).toLowerCase() === '.rar' // jshint ignore:line
			|| path.extname(filename).toLowerCase() === '.gz' // jshint ignore:line
		);
	}

	static isBufferCompressed (buf) {
		if (!buf || buf.length < 2)
			return (false);
		return (buf[0] === 0x78 && (buf[1] === 1 || buf[1] === 0x9c || buf[1] === 0xda));
	}

	static _Base64encode (st) {
		return (st
			.replace(/\+/g, '-') // Convert '+' to '-'
			.replace(/\//g, '_') // Convert '/' to '_'
			.replace(/=+$/, '')
		);
	}

	static safeBase64encode (st) {
		return (Buffer.from(st).toString('base64')
			.replace(/\+/g, '-') // Convert '+' to '-'
			.replace(/\//g, '_') // Convert '/' to '_'
			.replace(/=+$/, '')
		);
	}

	static _safeBase64decode (base64) {
		// Add removed at end '='
		base64 += Array(5 - base64.length % 4).join('=');
		base64 = base64
			.replace(/-/g, '+') // Convert '-' to '+'
			.replace(/_/g, '/'); // Convert '_' to '/'
		return (base64);
	}

	static safeBase64decode (base64) {
		// Add removed at end '='
		base64 += Array(5 - base64.length % 4).join('=');
		base64 = base64
			.replace(/-/g, '+') // Convert '-' to '+'
			.replace(/_/g, '/'); // Convert '_' to '/'
		return (Buffer.from(base64, 'base64').toString());
	}

	static readdir (pathname) {
		return (new Promise((fulfill, reject) => {
			fs.readdir(pathname, (err, files) => {
				if (err)
					reject(err);
				else
					fulfill(files);
			});
		}));
	}

	static rimraf (pathname) {
		return (new Promise((fulfill, reject) => {
			rimraf(pathname, (err) => {
				if (err)
					reject(err);
				else
					fulfill(pathname);
			});
		}));
	}

	static checkHost (req, domain) { // eslint-disable-line no-unused-vars
		//return ( domain === '' || req.headers.referer === domain ) ;
		return (true);
	}

	static returnResponseError (res, err) {
		let msg = err.message || err.statusMessage || 'Internal Failure';
		let code = err.code || err.statusCode || 500;
		if (code === 'ENOENT') {
			code = 404;
			msg = 'Not Found';
		}
		res
			.status(code)
			.end(msg);
	}

	static accepts (req) {
		if (req.header('x-no-compression') !== undefined)
			return ('');
		let type = req.header('Accept-Encoding');
		if (/(gzip)/g.test(type))
			return ('gzip');
		if (/(deflate)/g.test(type))
			return ('deflate');
		return ('');
	}

	static authorization (req) {
		let bearer = req.header('Authorization');
		if (bearer === undefined)
			return (null);
		let result = bearer.match(/^Bearer\s(.*)$/);
		if (result)
			return (result[1]);
		return (null);
	}

	static csv (st) {
		let dbIds = st.split(','); // csv format
		dbIds = dbIds.map((elt) => {
			let r = elt.match(/^(\d+)-(\d+)$/);
			if (r === null) {
				if (elt === '*')
					return (elt);
				return (parseInt(elt));
			}
			let t = [];
			for (let i = parseInt(r[1]); i <= parseInt(r[2]); i++)
				t.push(i);
			return (t);
		});
		//return (dbIds) ;
		return ([].concat.apply([], dbIds));
	}

	static logTimeStamp (msg) {
		msg = msg || '';
		let date = new Date();
		let hour = date.getHours();
		hour = (hour < 10 ? '0' : '') + hour;
		let min = date.getMinutes();
		min = (min < 10 ? '0' : '') + min;
		let sec = date.getSeconds();
		sec = (sec < 10 ? '0' : '') + sec;
		let msec = date.getMilliseconds();
		console.log(hour + ':' + min + ':' + sec + ':' + msec + ' - ' + msg);
	}

	// https://github.com/joliss/promise-map-series
	static promiseSerie (array, iterator, thisArg) {
		let length = array.length;
		let current = Promise.resolve();
		let results = new Array(length);
		let cb = arguments.length > 2 ? iterator.bind(thisArg) : iterator;
		for (let i = 0; i < length; i++) {
			// eslint-disable-next-line no-shadow
			current = results[i] = current.then(function (i) { // jshint ignore:line
				return (cb(array[i], i, array));
			}.bind(undefined, i));
		}
		return (Promise.all(results));
	}

	// This function allow you to modify a JS Promise by adding some status properties.
	// Based on: http://stackoverflow.com/questions/21485545/is-there-a-way-to-tell-if-an-es6-promise-is-fulfilled-rejected-resolved
	// But modified according to the specs of promises : https://promisesaplus.com/
	static PromiseStatus (promise) {
		// Don't modify any promise that has been already modified.
		if (promise.isResolved)
			return (promise);

		// Set initial state
		let isPending = true;
		let isRejected = false;
		let isFulfilled = false;

		// Observe the promise, saving the fulfillment in a closure scope.
		let result = promise.then(
			function (v) {
				isFulfilled = true;
				isPending = false;
				return (v);
			},
			function (e) {
				isRejected = true;
				isPending = false;
				throw e;
			}
		);

		result.isFulfilled = () => { return (isFulfilled); };
		result.isPending = () => { return (isPending); };
		result.isRejected = () => { return (isRejected); };
		return (result);
	}

	static promiseAllLimit (array, limit, iterator, thisArg) {
		// let length =array.length ;
		// let results =new Array (length) ;
		// for ( let i =0 ; i < length ; i++ )
		// 	results [i] =undefined ;
		// let tmp =new Array (limit) ;
		// let itmp =new Array (limit) ;
		// let cb =arguments.length > 2 ? iterator.bind (thisArg) : iterator ;
		let data = {
			limit: limit,
			length: array.length,
			results: new Array(array.length).fill(undefined),
			tmp: new Array(Math.min(limit, array.length)).fill(undefined),
			itmp: new Array(Math.min(limit, array.length)).fill(-1),
			cb: arguments.length > 2 ? iterator.bind(thisArg) : iterator,
			index: Math.min(limit, array.length)
		};

		return (new Promise(function (fulfill, reject) {
			for (let i = 0; i < this.limit && i < this.length; i++) {
				this.tmp[i] = this.cb(array[i], i, array);
				this.itmp[i] = i;
			}

			
			function waitOneMore (data) { // eslint-disable-line no-shadow
				Promise.race(data.tmp)
					// eslint-disable-next-line no-unused-vars
					.then(function (res) {
						let nb = [];
						for (let k = 0; k < this.tmp.length; k++) {
							if (!this.tmp[k].isPending()) {
								this.results[this.itmp[k]] = this.tmp[k];
								this.itmp[k] = -1;
								this.tmp[k] = undefined;
								nb.push(k);
							}
						}
						let loop = false;
						for (let n = 0; n < nb.length && this.index < this.length; n++ , this.index++) {
							this.tmp[nb[n]] = this.cb(array[this.index], this.index, array);
							this.itmp[nb[n]] = this.index;
							loop = this.index;
						}
						if (loop !== false) {
							waitOneMore(this);
						} else {
							this.tmp = this.tmp.filter((elt) => { return (elt !== undefined); });
							this.itmp = this.itmp.filter((elt) => { return (elt !== -1); });
							Promise.all(this.tmp)
								.then((_res) => { // eslint-disable-line no-unused-vars
									for (let k = 0; k < this.tmp.length; k++)
										this.results[this.itmp[k]] = this.tmp[k];
									Promise.all(this.results)
										.then((res2) => { fulfill(res2); });
								});
						}

					}.bind(data)/*.bind (undefined, { i: i, tmp: tmp, itmp: itmp })*/)
					.catch((err) => {
						reject(err);
					});
			}

			waitOneMore(this);
		}.bind(data)));
	}

	/* promiseAllLimit example:
	
	function test (x) {
		return (utils.PromiseStatus (new Promise ((fulfill, reject) => {
			console.log (`calling test (${x})`) ;
			setTimeout (() => { fulfill (x * x) ; console.log (`resolving test (${x})`) ; }, x * 100) ;
		}))) ;
	}
	
	let jobs = [1, 2, 3, 4, 5, 6, 7, 8, 9]
		.map ((elt) => function () { return ([test, arguments]) ; } (elt)) ;
	
	utils.promiseAllLimit (jobs, 3, (elt, index, arr) => elt [0].apply (null, elt [1]))
		.then ((prs) => console.log (prs))
		.catch ((err) => console.log (err)) ;
	*/

}

// Array.prototype.flatMap =(lambda) => {
//  	return (Array.prototype.concat.apply ([], this.map (lambda))) ;
// } ;

module.exports = utils;