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
/*jshint -W014 */
/*jshint -W083 */

const ForgeAPI = require('forge-apis');
const zip = require('node-zip');
//const archiver =require ('archiver') ;
//const ejs =require ('ejs') ;
const mkdirp = require('mkdirp');
const fs = require('fs');
//const ws = require('ws');
const zlib = require('zlib');
const path = require('path');
const utils = require('./utils');
const unirest = require('unirest');
const https = require('https');
//const _url = require('url');

class svfBubble {

	constructor (progress) {
		this._outPath = './';
		this._token = null;
		this._progress = progress;
		//this._filesToFetch =0 ;
		//this._estimatedSize =0 ;
		//this._progress =0 ;
		this._viewables = []; // { path: '', name: '' }
		this._errors = []; // ''
	}

	downloadBubble (urn, outPath, token) {
		let self = this;
		if (token) {
			self._token = new ForgeAPI.AuthClientTwoLegged('__', '__', ['data:read']);
			self._token.setCredentials({
				'token_type': 'Bearer',
				'expires_in': 1799,
				'access_token': token
			});
		} else {
			self._token = token.RW;
		}
		self._outPath = outPath;
		return (new Promise((fulfill, reject) => {
			self._progress.msg = 'Downloading manifest';
			self.getManifest(urn)
				.then((bubble) => {
					utils.writeFile (path.join (outPath, 'bubble.json'), bubble.body) ;
					self._progress.msg = 'Listing all derivative files';
					self.listAllDerivativeFiles(bubble.body, (error, result) => {
						self._progress._filesToFetch = result.list.length;
						console.log('Number of files to fetch:', self._progress._filesToFetch);
						self._progress._estimatedSize = 0 | (result.totalSize / (1024 * 1024));
						console.log('Estimated download size:', self._progress._estimatedSize, 'MB');

						//self.fixFlatBubbles (result) ;
						//self.fixFusionBubbles (result) ;

						self._progress.msg = 'Downloading derivative files';
						self.downloadAllDerivativeFiles(result.list, self._outPath, (failed, succeeded) => {
							//if ( ++self._done == 1 /*2*/ )
							//	return ;
							self.failed = failed;
							self.succeeded = succeeded;
							fulfill(self);
						});
					});
				})
				.catch((err) => {
					console.error('Error:', err.message);
					self._errors.push(err.message);
					reject(self);
				});
		}));
	}

	listAllDerivativeFiles (bubble, callback) {
		let self = this;
		// First get all the root derivative files from the bubble
		let res = [];
		(function traverse (node, parent) {
			if (node.role === 'Autodesk.CloudPlatform.PropertyDatabase' // eslint-disable-line no-multi-spaces
				|| node.role === 'Autodesk.CloudPlatform.DesignDescription'
				|| node.role === 'Autodesk.CloudPlatform.IndexableContent'
				|| node.role === 'graphics'
				|| node.role === 'raas'
				|| node.role === 'pdf'
				|| node.role === 'leaflet-zip'
				|| node.role === 'preview'
				|| node.role === 'lod'
			) {
				let item = { mime: node.mime };
				self.extractPathsFromGraphicsUrn(node.urn, item);
				//if ( item.localPath === '' )
				//	item.localPath =parent.guid + '/' ;
				// Optionally replace the path in the source bubble by the local path
				// for use as local bubbles in the viewer
				node.urn = '$file$/' + item.localPath + item.rootFileName;
				res.push(item);
				if (node.mime === 'application/autodesk-svf' // eslint-disable-line no-multi-spaces
					|| node.mime === 'application/autodesk-f2d'
				) {
					item.name = node.name = parent.name;
					if (parent.hasThumbnail === 'true') {
						let thumbnailItem = {
							mime: 'thumbnail', urn: bubble.urn, guid: parent.guid,
							localPath: item.localPath,
							thumbnailUrn: '$file$/thumbnails/' + parent.guid + '.png',
							rootFileName: (item.rootFileName + '.png')
						};
						res.push(thumbnailItem);
					}
				}
			}
			if (node.type === 'geometry') {
				// Why would we be sane and use real booleans??
				//if ( node.hasThumbnail === 'true' ) {
				//	let item ={ mime: 'thumbnail', urn: bubble.urn, guid: node.guid } ;
				//	if ( node.guid.substring (0, 1) === '{' ) {
				//		try {
				//			let guidObject =JSON.parse (node.guid) ;
				//			node.assetguid =guidObject.asset ;
				//			item.assetguid =guidObject.asset ;
				//		} catch ( ex ) {
				//		}
				//	}
				//	item.localPath ='/' ;
				//	node.thumbnailUrn ='$file$/thumbnails/' + item.guid + '.png' ;
				//	res.push (item) ;
				//}
				if (node.intermediateFile && node.children) {
					// We will derive the full intermediate file path from the child F2D node
					let f2dNode = null;
					for (let i = 0; i < node.children.length; i++) {
						if (node.children[i].mime === 'application/autodesk-f2d') {
							f2dNode = node.children[i];
							break;
						}
					}
					if (f2dNode) {
						let f2dUrl = f2dNode.urn;
						let idx = f2dUrl.indexOf(bubble.urn);
						let baseUrl = f2dUrl.substr(0, idx + bubble.urn.length);
						let item = { mime: 'application/octet-stream', urn: bubble.urn, guid: node.guid };
						// Construct the full urn path, similar to how it's stored for the SVF geometry items
						let intPath = '/' + node.intermediateFile;
						if (baseUrl.indexOf('urn:adsk.objects') === 0)
							intPath = encodeURIComponent(intPath);
						let fullPath = baseUrl + intPath;
						self.extractPathsFromGraphicsUrn(fullPath, item);
						res.push(item);
					}
				}
			}
			if (node.children) {
				node.children.forEach((child) => {
					traverse(child, node);
				});
			}
		})(bubble, null);

		console.log('Manifests to process: ', res.length);
		if (res.length === 0)
			return (callback(null, { list: [], totalSize: 0 }));

		let current = 0;
		let done = 0;
		let estSize = 0;
		let countedPropDb = {};

		let processOne = () => {
			function onProgress () {
				done++;
				console.log('Manifests done ', done);
				if (done === res.length) {
					let result = {
						list: res,
						totalSize: estSize
					};
					callback(null, result);
				} else {
					setTimeout(processOne, 0);
				}
			}

			if (current >= res.length)
				return;
			let rootItem = res[current++];
			let basePath = '';
			let files = rootItem.files = [];
			if (rootItem.mime !== 'thumbnail')
				basePath = rootItem.basePath;
			if (rootItem.mime === 'application/autodesk-db') {
				// The file list for property database files is fixed,
				// no need to go to the server to find out
				files.push('objects_attrs.json.gz');
				files.push('objects_vals.json.gz');
				files.push('objects_avs.json.gz');
				files.push('objects_offs.json.gz');
				files.push('objects_ids.json.gz');
				// f2d will reference us, but not the svf :( - add ourself here
				files.push(rootItem.rootFileName);
				onProgress();
			} else if (rootItem.mime === 'thumbnail') {
				//rootItem.files.push ((rootItem.assetguid || rootItem.guid) + '.png') ;
				rootItem.files.push(rootItem.rootFileName);
				onProgress();
			} else if (rootItem.mime === 'application/autodesk-svf') {
				let svfPath = rootItem.urn.slice(basePath.length);
				files.push(svfPath);
				// Closure to capture loop-variant variable for the getItem callback
				(() => {
					let myItem = rootItem;
					self.getItem(rootItem.urn, null, (error, success) => {
						if (error)
							self._errors.push('Failed to download ' + myItem.urn);
						if (success) {
							let manifest = '';
							try {
								let pack = new zip(success, { base64: false, checkCRC32: true });
								success = pack.files['manifest.json'].asNodeBuffer();
								manifest = JSON.parse(success.toString('utf8'));
							} catch (e) {
								console.error('Error:', e.message);
								self._errors.push(e.message);
							}
							if (manifest && manifest.assets) {
								for (let j = 0; j < manifest.assets.length; j++) {
									let asset = manifest.assets[j];
									// Skip SVF embedded resources
									if (asset.URI.indexOf('embed:/') === 0)
										continue;
									// Skip non-local property db files
									// Those are listed explicitly in the bubble as property database role
									// so we will get them anyway
									if (asset.URI.indexOf('../') === 0) {
										// To get a correct bubble size estimate,
										// we get the property db file sizes from the SVF manifest,
										// because they are not available in the bubble itself.
										// It's ugly, but such is bubble life.
										// Also, this number seems to be the uncompressed size of the property db files,
										// so it's an overestimate, and we divide by 4 to get a more reasonable one.
										if (!countedPropDb[rootItem.basePath])
											estSize += asset.size / 4;
										continue;
									}
									estSize += asset.size;
									myItem.files.push(asset.URI);
								}
							}
							countedPropDb[rootItem.basePath] = 1;
						}
						onProgress();
					});
				})();
			} else if (rootItem.mime === 'application/autodesk-f2d') {
				files.push('manifest.json.gz');
				let manifestPath = basePath + 'manifest.json.gz';
				// Closure to capture loop-variant variable for the getItem callback
				(() => {
					let myItem = rootItem;
					self.getItem(manifestPath, null, (error, success) => {
						if (error)
							self._errors.push('Failed to download ' + myItem.urn);
						if (success) {
							estSize += success.length;
							let manifest = '';
							try {
								if (success[0] === 0x1f && success[1] === 0x8b)
									success = zlib.gunzipSync(success);
								manifest = JSON.parse(success.toString('utf8'));
							} catch (e) {
								console.error('Error:', e.message);
								self._errors.push(e.message);
							}
							if (manifest && manifest.assets) {
								for (let j = 0; j < manifest.assets.length; j++) {
									let asset = manifest.assets[j];
									// Skip non-local property db files
									// Those are listed explicitly in the bubble as property database role
									// so we will get them anyway
									if (asset.URI.indexOf('../') === 0)
										continue;
									estSize += asset.size;
									myItem.files.push(asset.URI);
								}
							}
						}
						onProgress();
					});
				})();
			} else {
				// All other files are assumed to be just the file listed in the bubble
				files.push(rootItem.rootFileName);
				onProgress();
			}
		};
		// Kick off 6 parallel jobs
		for (let k = 0; k < 6; k++)
			processOne();
	}

	downloadAllDerivativeFiles (fileList, destDir, callback) {
		let self = this;
		let succeeded = 0;
		let failed = 0;
		let flatList = [];
		for (let i = 0; i < fileList.length; i++) {
			let item = fileList[i];
			for (let j = 0; j < item.files.length; j++) {
				let flatItem = {
					basePath: item.basePath,
					localPath: destDir + item.localPath,
					fileName: item.files[j]
				};
				if (item.name)
					flatItem.name = item.name;
				if (item.urn) {
					flatItem.urn = item.urn;
					flatItem.guid = item.guid;
					flatItem.mime = item.mime;
				}
				flatList.push(flatItem);
			}
		}
		if (flatList.length === 0)
			return (callback(failed, succeeded));
		let current = 0;
		let done = 0;
		let downloadOneItem = () => {
			if (current >= flatList.length)
				return;
			let fi = flatList[current++];
			let downloadComplete = (error, success) => { // eslint-disable-line no-unused-vars
				done++;
				if (error) {
					failed++;
					console.error('Failed to download file:', fi.localPath + fi.fileName, error);
					self._errors.push('Failed to download file: ' + fi.localPath + fi.fileName);
				} else {
					succeeded++;
					console.log('Downloaded:', fi.localPath + fi.fileName);
				}
				self._progress._progress = (100 * (failed + succeeded) / flatList.length) | 0;
				console.log('Progress:', self._progress._progress, '%');
				if (done === flatList.length)
					callback(failed, succeeded);
				else
					setTimeout(downloadOneItem, 0);
			};
			if (fi.mime && fi.mime === 'thumbnail')
				self.getThumbnail(fi.urn, fi.guid, 400, fi.localPath + fi.fileName, downloadComplete);
			else
				self.getItem(fi.basePath + fi.fileName, fi.localPath + fi.fileName, downloadComplete);
			if ((fi.mime === 'application/autodesk-svf' // eslint-disable-line no-multi-spaces
				|| fi.mime === 'application/autodesk-f2d')
				&& (path.extname(fi.fileName).toLowerCase() === '.svf' // eslint-disable-line no-multi-spaces
					|| path.extname(fi.fileName).toLowerCase() === '.f2d')
			)
				self._viewables.push({ path: ('./' + fi.localPath.substring(self._outPath.length) + fi.fileName), name: fi.name });
		};
		// Kick off 10 parallel jobs
		for (let k = 0; k < 10; k++)
			downloadOneItem();
	}

	extractPathsFromGraphicsUrn (urn, result) {
		// This needs to be done for encoded OSS URNs, because the paths
		// in there are url encoded and lose the / character.
		urn = decodeURIComponent(urn);
		let basePath = urn.slice(0, urn.lastIndexOf('/') + 1);
		let localPath = basePath.slice(basePath.indexOf('/') + 1);
		//let urnBase =basePath.slice (0, basePath.indexOf ('/')) ;
		localPath = localPath.replace(/^output\//, '');
		// For supporting compound bubbles, we need to prefix
		// by sub-urn as well, otherwise files might clash.
		// let localPrefix = urnBase ? crypto.createHash('md5').update(urnBase).digest('hex') + '/' : '';
		let localPrefix = '';
		result.urn = urn;
		result.basePath = basePath;
		result.localPath = localPrefix + localPath;
		result.rootFileName = urn.slice(urn.lastIndexOf('/') + 1);
	}

	getManifest (urn) {
		if (urn === undefined || urn === null)
			return (Promise.reject('Missing the required parameter {urn} when calling getManifest'));
		let ModelDerivative = new ForgeAPI.DerivativesApi();
		return (ModelDerivative.apiClient.callApi(
			'/derivativeservice/v2/manifest/{urn}', 'GET',
			{ 'urn': urn }, {}, { /*'Accept-Encoding': 'gzip, deflate'*/ },
			{}, null,
			[], ['application/vnd.api+json', 'application/json'], null,
			this._token, this._token.getCredentials()
		));
	}

	downloadItem (urn) {
		if (urn === undefined || urn === null)
			return (Promise.reject('Missing the required parameter {urn} when calling getManifest'));
		let ModelDerivative = new ForgeAPI.DerivativesApi();
		return (ModelDerivative.apiClient.callApi(
			'/derivativeservice/v2/derivatives/{urn}', 'GET',
			{ 'urn': urn }, {}, { 'Accept-Encoding': 'gzip, deflate' },
			{}, null,
			[], [], null,
			this._token, this._token.getCredentials()
		));
	}

	openWriteStream (outFile) {
		let wstream = null;
		if (outFile) {
			try {
				mkdirp.sync(path.dirname(outFile));
				wstream = fs.createWriteStream(outFile);
			} catch (e) {
				console.error('Error:', e.message);
			}
		}
		return (wstream);
	}

	getItem (itemUrn, outFile, callback) {
		let self = this;
		this.downloadItem(itemUrn)
			.then((response) => {
				if (response.statusCode !== 200)
					return (callback(response.statusCode));
				// Skip unzipping of items to make the downloaded content compatible with viewer debugging
				let wstream = self.openWriteStream(outFile);
				if (wstream) {
					wstream.write(typeof response.body === 'object' && path.extname(outFile) === '.json' ? JSON.stringify(response.body) : response.body);
					wstream.end();
					callback(null, response.statusCode);
				} else {
					callback(null, response.body);
				}
			})
			.catch((error) => {
				console.error('Error:', error.message);
				self._errors.push('Error: ' + error.message);
				callback(error, null);
			});
	}

	getThumbnail (urn, guid, sz, outFile, callback) {
		let self = this;
		let ModelDerivative = new ForgeAPI.DerivativesApi();
		//console.log ('Thumbnail URN: ', urn, 'GUID: ', guid) ;
		//ModelDerivative.getThumbnail (urn, { width: sz, height: sz }, this._token, this._token.getCredentials ())
		//	.then ((thumbnail) => {
		//		//fs.writeFile (outFile, thumbnail.body) ;
		//		let wstream =self.openWriteStream (outFile) ;
		//		if ( wstream ) {
		//			wstream.write (thumbnail.body) ;
		//			wstream.end () ;
		//			callback (null, thumbnail.statusCode) ;
		//		} else {
		//			callback (null, thumbnail.body) ;
		//		}
		//	})
		//	.catch ((error) => {
		//		console.error ('Error:', error.message) ;
		//		self._errors.push ('Error: ' + error.message) ;
		//		callback (error, null) ;
		//	})
		//;
		if (urn === undefined || urn === null)
			return (Promise.reject('Missing the required parameter {urn} when calling getManifest'));
		let queryParams = { width: sz, height: sz, role: 'rendered' };
		if (guid)
			queryParams.guid = guid;
		ModelDerivative.apiClient.callApi(
			'/derivativeservice/v2/thumbnails/{urn}', 'GET',
			{ 'urn': urn }, queryParams, {},
			{}, null,
			[], ['application/octet-stream'], null,
			this._token, this._token.getCredentials()
		)
			.then((thumbnail) => {
				//fs.writeFile (outFile, thumbnail.body) ;
				let wstream = self.openWriteStream(outFile);
				if (wstream) {
					wstream.write(thumbnail.body);
					wstream.end();
					callback(null, thumbnail.statusCode);
				} else {
					callback(null, thumbnail.body);
				}
			})
			.catch((error) => {
				console.error('Error:', error.message);
				self._errors.push('Error: ' + error.message);
				callback(error, null);
			});
	}

	//fixFlatBubbles (result) {
	//	// Trying to fix paths without breaking ones which are already good
	//	// We're lucky that our array is sorted by viewables
	//	let guid ='f0224dd3-8767-45c1-ff99-5c9c881b9fee' ;
	//	for ( let i =0 ; i < result.list.length ; i++ ) { // Find the first thumbnail guid to start with
	//		if ( result.list [i].mime === 'thumbnail' ) {
	//			guid =result.list [i].guid ;
	//			break ;
	//		}
	//	}
	//	for ( let i =0 ; i < result.list.length ; i++ ) {
	//		let obj =result.list [i] ;
	//		if ( obj.rootFileName === 'designDescription.json' ) {
	//			// Do nothing
	//		} else if ( obj.mime !== 'thumbnail' ) {
	//			if ( obj.localPath === '' )
	//				obj.localPath =guid + '/' ;
	//		} else { // Switch guid
	//			guid =obj.guid ;
	//		}
	//	}
	//}
	//
	//fixFusionBubbles (result) {
	//	// We're lucky that our array is sorted by viewables
	//	let bFusionFixRequired =false
	//	let guid ='f0224dd3-8767-45c1-ff99-5c9c881b9fee' ;
	//	for ( let i =0 ; i < result.list.length ; i++ ) { // Find the first thumbnail guid to start with
	//		let obj =result.list [i] ;
	//		if ( result.list [i].rootFileName === 'designDescription.json' ) {
	//			// Do nothing
	//		} else if ( obj.mime === 'thumbnail' ) {
	//			guid =obj.assetguid || obj.guid ;
	//			bFusionFixRrequired =obj.assetguid !== undefined ;
	//			break ;
	//		}
	//	}
	//	//if ( !bFusionFixRequired )
	//	//	return ;
	//	for ( let i =0 ; i < result.list.length ; i++ ) {
	//		let obj =result.list [i] ;
	//		if ( obj.mime !== 'thumbnail' ) {
	//			if (    bFusionFixRequired
	//				|| /^[0-9]+\/.*$/.test (obj.localPath)
	//				|| /^(Resource)\/.*$/.test (obj.localPath)
	//			) {
	//				let paths =obj.localPath.split ('/') ;
	//				paths [0] =guid ;
	//				obj.localPath =paths.join ('/') ;
	//			}
	//			//else if ( /^(Resource)\/.*$/.test (obj.localPath) ) {
	//			//	let paths =obj.localPath.split ('/') ;
	//			//	paths.unshift (guid) ;
	//			//	obj.localPath =paths.join ('/') ;
	//			//}
	//		} else { // Switch guid
	//			guid =obj.assetguid || obj.guid ;
	//		}
	//	}
	//}

}

class otgBubble {

	constructor (progress) {
		this._urn = '';
		this._outPath = './';
		this._token = null;
		this._progress = progress;
		this._errors = [];

		this._manifest = null;
		this._otg_manifest = null;
		this._otg_models = {};
		this._urns = [];
	}

	get host () { return ('https://otg.autodesk.com'); }

	get urn () { return (this._urn); }
	set urn (urn) { this._urn = urn; }

	get manifest () { return (this._manifest); }
	set manifest (manifest) { this._manifest = manifest; }

	get otg_manifest () { return (this._otg_manifest); }
	set otg_manifest (manifest) { this._otg_manifest = manifest; }

	get account_id () { return (this.otg_manifest.account_id); }
	get project_id () { return (this.otg_manifest.project_id); }

	get global_root () { return (this.otg_manifest.paths.global_root); }
	get global_sharding () { return (this.otg_manifest.paths.global_sharding); }
	get version_root () { return (this.otg_manifest.paths.version_root); }
	get shared_root () { return (this.otg_manifest.paths.shared_root); }
	get region () { return (this.otg_manifest.paths.region); }

	get local_version_root () { return (path.join(this._outPath, this.otg_manifest.paths.version_root.substring(this.otg_manifest.paths.shared_root.length))); }
	get local_shared_root () { return (this._outPath); }
	set local_shared_root (outPath) { this._outPath = outPath; }
	get remote_root_path () { return (this.otg_manifest.paths.version_root.substring(this.otg_manifest.paths.shared_root.length)); }

	geometry_urn (viewId) { return (this.OTG_models[viewId].manifest.shared_assets.geometry); }
	materials_urn (viewId) { return (this.OTG_models[viewId].manifest.shared_assets.materials); }
	textures_urn (viewId) { return (this.OTG_models[viewId].manifest.shared_assets.textures); }

	local_geometry_root (viewId) { return (path.join(this._outPath, 'cdn', this.geometry_urn(viewId).substring(this.global_root.length))); }
	local_materials_root (viewId) { return (path.join(this._outPath, 'cdn', this.materials_urn(viewId).substring(this.global_root.length))); }
	local_textures_root (viewId) { return (path.join(this._outPath, 'cdn', this.textures_urn(viewId).substring(this.global_root.length))); }

	numFragments (viewId) { return (this.OTG_models[viewId].stats.num_fragments); }
	numPolys (viewId) { return (this.OTG_models[viewId].stats.num_polys); }
	numMaterials (viewId) { return (this.OTG_models[viewId].stats.num_materials); }
	numGeoms (viewId) { return (this.OTG_models[viewId].stats.num_geoms); }
	numTextures (viewId) { return (this.OTG_models[viewId].stats.num_textures); }

	// get OTG_models () { views.map ((elt) => { return (elt.urn) ; }) }
	// get OTG_models_keys () { Object.keys (otg_manifest.views) }
	get OTG_models () { return (this._otg_models); }
	set OTG_models (val) { this._otg_models = val; }

	downloadBubble (urn, outPath, token) {
		let self = this;
		self.local_shared_root = outPath;
		self.urn = urn;
		if (token) {
			self._token = new ForgeAPI.AuthClientTwoLegged('__', '__', ['data:read']);
			self._token.setCredentials({
				'token_type': 'Bearer',
				'expires_in': 1799,
				'access_token': token
			});
		} else {
			self._token = token.RW;
		}
		return (new Promise((fulfill, reject) => {
			self._progress.msg = 'Downloading manifest';
			self.getManifest(self.urn)
				// Collect and Analyze the Design manifest
				.then((bubble) => {
					self.manifest = bubble.body;
					// Code for GET /modeldata/manifest/{urn}
					self.otg_manifest = bubble.body.children.filter((elt) => { return (elt.role === 'viewable' && elt.otg_manifest); });
					if (self.otg_manifest.length !== 1)
						throw new Error('Unexpected OTG manifest format.');
					self.otg_manifest = self.otg_manifest[0].otg_manifest;

					// Code for GET /modeldata/otgmanifest/{urn}
					// self.otg_manifest =bubble.body ;

					// Save manifests
					let outFile = path.resolve(path.join(self.local_shared_root, self.remote_root_path, 'bubble.json'));
					utils.writeFile(outFile, bubble.body)
						.catch((err) => console.error('Error:', err.message));
					outFile = path.resolve(path.join(self.local_shared_root, self.remote_root_path, 'otg_manifest.json'));
					utils.writeFile(outFile, bubble.body.children[0].otg_manifest)
						.catch((err) => console.error('Error:', err.message));

					// Find each view Manifest, and linked files (like the AECModelData.json)
					self.OTG_models = {};
					let jobs = [];
					for (let [key, value] of Object.entries(self.otg_manifest.views)) {
						jobs.push(self.getViewModelManifest(self.version_root, value.urn, self.urn, self.local_version_root));
						if (value.role === 'graphics' && value.mime === 'application/autodesk-otg')
							self.OTG_models[key] = jobs.length - 1;
					}

					// Get placement.json file
					outFile = path.resolve(path.join(self.local_shared_root, self.remote_root_path));
					jobs.push(self.getViewModelManifest(self.version_root, 'placement.json', self.urn, outFile));
					return (Promise.all(jobs.map(p => p.catch(() => undefined))));
				})
				// Collect and Analyze each view otg_model.json
				.then((manifestsjson) => {
					self._urns = [];
					let jobs = [];
					// We only need to keep and proceed the otg_model.json files
					for (let [key, value] of Object.entries(self.OTG_models)) {
						self.OTG_models[key] = manifestsjson[value];
						let elt = manifestsjson[value];
						elt.jobs = [];
						elt.__dependencies__ = {};
						if (!elt.manifest || !elt.manifest.assets) // Unexpected OTG manifest format.
							continue;

						// otg_model.json|manifest.assets (fragments.fl fragments_extra.fl materials_ptrs.hl geometry_ptrs.hl texture_manifest.json pdb/avs.pack pdb/avs.idx pdb/dbid.idx)
						for (let [assetkey, asset] of Object.entries(elt.manifest.assets)) {
							// fragments.fl fragments_extra.fl materials_ptrs.hl geometry_ptrs.hl texture_manifest.json
							if (typeof asset === 'string') {
								let outFile = path.join(self.local_version_root, elt.__dirname__, asset);
								//elt.jobs.push (self.getViewModelFile (self.version_root, path.join (elt.__dirname__, asset), self.urn, outFile)) ;
								elt.jobs.push(function () { return ([self.getViewModelFile, arguments]); }(self.version_root, key, path.posix.join(elt.__dirname__, asset), self.urn, outFile));
								elt.__dependencies__[assetkey] = key + '%' + path.posix.join(elt.__dirname__, asset);
								continue;
							}
							// pdb/avs.pack pdb/avs.idx pdb/dbid.idx
							for (let [pdbkey, pdb] of Object.entries(asset)) {
								let st = path.join(self.local_version_root, elt.__dirname__, pdb);
								let outFile = path.join(path.dirname(st), /*pdbkey,*/ path.basename(st));
								st = path.posix.join(elt.__dirname__, pdb);
								if (self._urns.indexOf(self.version_root + st) !== -1)
									continue;
								self._urns.push(self.version_root + st);
								//elt.jobs.push (self.getViewModelFile (self.version_root, st, self.urn, outFile)) ;
								elt.jobs.push(function () { return ([self.getViewModelFile, arguments]); }(self.version_root, key, st, self.urn, outFile));
								elt.__dependencies__[pdbkey] = `${key}%${st}`;
							}
						}

						// otg_model.json|manifest.shared_assets (pdb/attrs.json pdb/vals.json pdb/ids.json)
						for (let [pdbkey, pdb] of Object.entries(elt.manifest.shared_assets.pdb)) {
							let outFile = path.join(self.local_version_root, elt.__dirname__, pdb);
							let st = path.posix.join(self.remote_root_path, elt.__dirname__, pdb);
							if (self._urns.indexOf(self.shared_root + st) !== -1)
								continue;
							self._urns.push(self.shared_root + st);
							//elt.jobs.push (self.getViewModelFile (self.shared_root, st, self.urn, outFile)) ;
							elt.jobs.push(function () { return ([self.getViewModelFile, arguments]); }(self.shared_root, key, st, self.urn, outFile));
							elt.__dependencies__[pdbkey] = `${key}%${st }`;
						}

						jobs = [...jobs, ...elt.jobs];
					}

					return (utils.promiseAllLimit(jobs, 10, (elt, index, arr) => utils.PromiseStatus(elt[0].apply(self, elt[1])))); // eslint-disable-line no-unused-vars
				})
				.then((results) => {
					let jobs = [];
					for (let [key, value] of Object.entries(self.OTG_models)) {
						for (let [asset, ijob] of Object.entries(value.__dependencies__)) { // eslint-disable-line no-unused-vars
							let result = results.filter(elt => elt[0] === value.__dependencies__[asset]);
							value.__dependencies__[asset] =result [0] [1];
						}

						if (value.stats.num_materials) {
							let materialHashes = self.decomposeHashFile(value.__dependencies__.materials_ptrs, self.global_sharding);
							materialHashes = materialHashes.filter (elt => elt[0] !== '' && elt[1] !== '');
							materialHashes.map((elt) => {
								//self.getSharedAssetFile (self.materials_urn (key), elt, self.urn, self.local_materials_root (key)) ;
								jobs.push(function () { return ([self.getSharedAssetJson, arguments]); }(self.materials_urn(key), elt, self.urn, self.local_materials_root(key)));
								return (null);
							});
						}
						if (value.stats.num_geoms) {
							let geometryHashes = self.decomposeHashFile(value.__dependencies__.geometry_ptrs, self.global_sharding);
							geometryHashes = geometryHashes.filter (elt => elt[0] !== '' && elt[1] !== '');
							geometryHashes.map((elt) => {
								//self.getSharedAssetFile (self.geometry_urn (key), elt, self.urn, self.local_geometry_root (key)) ;
								jobs.push(function () { return ([self.getSharedAssetFile, arguments]); }(self.geometry_urn(key), elt, self.urn, self.local_geometry_root(key)));
								return (null);
							});
						}
						if (value.stats.num_textures && value.__dependencies__.hasOwnProperty('texture_manifest')) { // eslint-disable-line no-prototype-builtins
							for (let [fn, hash] of Object.entries(value.__dependencies__.texture_manifest)) { // eslint-disable-line no-unused-vars
								let elt = [
									hash.substring(0, self.global_sharding),
									hash.substring(self.global_sharding)
								];
								jobs.push(function () { return ([self.getSharedAssetFile, arguments]); }(self.textures_urn(key), elt, self.urn, self.local_textures_root(key)));
							}
						}
						//break;
					}

					return (utils.promiseAllLimit(jobs, 10, (elt, index, arr) => utils.PromiseStatus(elt[0].apply(self, elt[1])))); // eslint-disable-line no-unused-vars
				})
				.then((files) => { // eslint-disable-line no-unused-vars
					console.log('Download complete.');
				})
				.catch((err) => {
					console.error('Error:', err.message || err.statusMessage);
					self._errors.push(err.message || err.statusMessage);
					reject(self);
				});
		}));
	}

	getManifest (urn) {
		if (urn === undefined || urn === null)
			return (Promise.reject('Missing the required parameter {urn} when calling getManifest'));
		let ModelDerivative = new ForgeAPI.DerivativesApi();
		ModelDerivative.apiClient.basePath = this.host;
		return (ModelDerivative.apiClient.callApi(
			'/modeldata/manifest/{urn}', 'GET', // full manifest
			//'/modeldata/otgmanifest/{urn}', 'GET', // only OTG manifest
			{ urn: urn }, {}, { /*'Accept-Encoding': 'gzip, deflate'*/ pragma: 'no-cache' },
			{}, null,
			[], ['application/vnd.api+json', 'application/json'], null,
			this._token, this._token.getCredentials()
		));
	}

	getViewModelManifest (fileurn, elt, modelurn, outPath) {
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn || !modelurn)
				return (reject('Missing the required parameter {urn} when calling getManifest'));
			let ModelDerivative = new ForgeAPI.DerivativesApi();
			ModelDerivative.apiClient.basePath = host;
			ModelDerivative.apiClient.callApi(
				'/modeldata/file/' + fileurn + encodeURI(elt), 'GET',
				{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
				{}, null,
				[], [ /*'application/vnd.api+json', 'application/json'*/], null,
				this._token, this._token.getCredentials()
			)
				.then((res) => {
					return (utils.gunzip(res.body));
				})
				.then((json) => {
					json.__dirname__ = path.dirname(elt);
					fulfill(json);

					let outFile = path.resolve(path.join(outPath, elt));
					console.log(' > ', outFile);
					return (utils.writeFile(outFile, json));
				})
				.catch((error) => {
					console.error(' !! ', outPath);
					reject(error);
				});
		}));
	}

	// Reference: https://zenhax.com/viewtopic.php?t=27
	static isGzip (buf) {
		return (buf[0] === 0x1f /*31*/ && buf[1] === 0x8b /*139*/);
	}

	getViewModelBinary (fileurn, key, elt, modelurn, outFile) {
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn || !modelurn)
				return (reject('Missing the required parameter {urn} when calling getViewModelBinary'));
			// Forge SDK and Unirest auto uncompress file :(
			// let req =unirest.get (host + path.posix.join ('/modeldata/file/', fileurn, encodeURI (elt)) + '?acmsession=' + modelurn)
			// 	.headers ({
			// 		'cache-control': 'no-cache',
			// 		pragma: 'no-cache',
			// 		//'Accept-Encoding': 'gzip, deflate',
			// 		Authorization: ('Bearer ' + this._token.getCredentials ().access_token)
			// 	});
			const options = {
				method: 'GET',
				hostname: host.replace(/http[s]*\:\/\//, ''),
				port: 443,
				path: ('/modeldata/file/' + fileurn + encodeURI(elt) + '?acmsession=' + modelurn),
				headers: {
					'Authorization': ('Bearer ' + this._token.getCredentials().access_token),
					'cache-control': 'no-cache',
					pragma: 'no-cache',
				}
			};
			https.get(options, (res) => {
				//res.setEncoding('binary');
				let data = [];
				res
					.on('data', (chunk) => {
						data.push(chunk);
					})
					.on('end', () => { // eslint-disable-line no-unused-vars
						let buffer = Buffer.concat(data);
						if (buffer.slice(0, 5).toString() === '<?xml') {
							console.error(' !! ', outFile);
							reject(buffer.toString());
							return;
						}
						if (otgBubble.isGzip(buffer)) {
							utils.gunzip(buffer, true)
								.then((result) => {
									fulfill([ `${key}%${elt}`, result ]);
									console.log(' >> ', outFile, elt);
									utils.writeFile(outFile, result, 'binary', true);
								})
								.catch((err) => {
									console.error(err);
									reject(err);
								});
						} else {
							fulfill([ `${key}%${elt}`, buffer ]);
							console.log(' >> ', outFile);
							utils.writeFile(outFile, buffer, 'binary', true);
						}
					});

			});
		}));
	}

	getViewModelJson (fileurn, key, elt, modelurn, outFile) {
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn || !modelurn)
				return (reject('Missing the required parameter {urn} when calling getManifest'));
			let ModelDerivative = new ForgeAPI.DerivativesApi();
			ModelDerivative.apiClient.basePath = host;
			ModelDerivative.apiClient.callApi(
				'/modeldata/file/' + fileurn + encodeURI(elt), 'GET',
				{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
				{}, null,
				[], ['application/json'], null,
				this._token, this._token.getCredentials()
			)
				.then((res) => {
					return (utils.gunzip(res.body, true));
				})
				.then((data) => {
					return (utils.writeFile(outFile, data, 'binary', true));
				})
				.then((data) => {
					console.log(' >> ', outFile);
					fulfill([ `${key}%${elt}`, JSON.parse(data.toString('utf-8')) ]);
				})
				.catch((error) => {
					console.error(' !! ', outFile);
					reject(error);
				});
		}));
	}

	getViewModelFile (fileurn, key, elt, modelurn, outFile) {
		if (path.extname(outFile) === '.json')
			return (this.getViewModelJson(fileurn, key, elt, modelurn, path.resolve(outFile)));
		else
			return (this.getViewModelBinary(fileurn, key, elt, modelurn, path.resolve(outFile)));
	}

	decomposeHashFile (content, sharding) {
		let byteStride = content[1] << 8 | content[0];
		if (byteStride % 4) {
			console.error(`Expected byte size to be multiple of 4, but got ${byteStride}`);
			return ([]);
		}
		//let version = content[3] << 8 | content[2];
		//let stride = byteStride / 4;
		let nb = content[5] << 8 | content[4];

		let bdata = new Uint8Array(byteStride);

		let results = [];
		for (let i = 1; i <= nb; i++) {
			//let streamOffset = i * byteStride;
			//let endOffset = streamOffset + byteStride;
			bdata.set(content.slice(i * byteStride, (i + 1) * byteStride));
			let st = Array.prototype.map.call(bdata, x => ('00' + x.toString(16)).slice(-2)).join('');
			results.push([st.slice(0, sharding), st.slice(sharding)]);
		}
		return (results);
	}

	getSharedAssetFile (fileurn, elt, modelurn, outPath) {
		let parts = fileurn.split('/');
		let account_id = parts[1];
		let type = parts[2];
		let outFile = path.resolve(path.join(outPath, type, elt[0], elt[1]));
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn)
				return (reject('Missing the required parameter {urn} when calling getSharedAssetFile'));
			if (outFile.endsWith('.png')) {
				let req = unirest.get(host + path.posix.join('/cdn/', elt[0], account_id, type, elt[1]) + '?acmsession=' + modelurn)
					.headers({
						pragma: 'no-cache',
						Authorization: ('Bearer ' + this._token.getCredentials().access_token)
					});
				if (outFile.endsWith('.png'))
					req.encoding('binary');
				req.send()
					.then((res) => {
						fulfill(res.body);
						console.log(' >> ', outFile);
						return (utils.writeFile(outFile, res.body, 'binary', true));
					})
					.catch((error) => {
						console.error(' !! ', outFile);
						reject(error);
					});
			} else {
				utils.fileexists (outFile)
					.then ((bExists) => {
						if (bExists && elt[0] !== 5000)
							return (fulfill(outFile));
						const options = {
							method: 'GET',
							hostname: host.replace(/http[s]*\:\/\//, ''),
							port: 443,
							path: (path.posix.join('/cdn/', elt[0], account_id, type, elt[1]) + '?acmsession=' + modelurn),
							headers: {
								'Authorization': ('Bearer ' + this._token.getCredentials().access_token),
								'cache-control': 'no-cache',
								pragma: 'no-cache',
							}
						};
						https.get(options, (res) => {
							//res.setEncoding('binary');
							let data = [];

							res.on('data', (chunk) => {
								data.push(chunk);
							}).on('end', () => {
								let buffer = Buffer.concat(data);
								if (buffer.slice(0, 5).toString() === '<?xml') {
									console.error(' !! ', outFile);
									reject(buffer.toString());
									return;
								}
								//utils.writeFile(outFile + '.gz', buffer, 'binary', true)
								otgBubble.gunzip(buffer, true)
									.then((result) => {
										fulfill(result);
										console.log(' >> ', outFile);
										return (utils.writeFile(outFile, result, 'binary', true));
									})
									.catch((error) => {
										console.error(' !! ', outFile);
										reject(error);
									});
							});
						});
					});
			}
		}));
	}

	getSharedAssetJson (fileurn, elt, modelurn, outPath) {
		let parts = fileurn.split('/');
		let account_id = parts[1];
		let type = parts[2];
		let outFile = path.resolve(path.join(outPath, type, elt[0], elt[1]));
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn)
				return (reject('Missing the required parameter {urn} when calling getSharedAssetJson'));
			utils.fileexists (outFile)
				.then ((bExists) => {
					if (bExists)
						return (fulfill(outFile));
					let ModelDerivative = new ForgeAPI.DerivativesApi();
					ModelDerivative.apiClient.basePath = host;
					ModelDerivative.apiClient.callApi(
						path.posix.join('/cdn/', elt[0], account_id, type, elt[1]), 'GET',
						{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
						{}, null,
						[], ['application/json'], null,
						this._token, this._token.getCredentials()
					)
						.then((res) => {
							return (utils.gunzip(res.body));
						})
						.then((json) => {
							fulfill(json);
							console.log(' >> ', outFile);
							return (utils.writeFile(outFile, json));
						})
						.catch((error) => {
							console.error(' !! ', outFile);
							reject(error);
						});
				});
		}));
	}

	static gunzip (res, bRaw = false) {
		return (new Promise((fulfill, reject) => { // eslint-disable-line no-unused-vars
			zlib.gunzip(res, (err, dezipped) => {
				if (err)
					return(fulfill(res));
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

}

class svf2Bubble {

	constructor (progress) {
		this._urn = '';
		this._outPath = './';
		this._token = null;
		this._progress = progress;
		this._errors = [];

		this._manifest = null;
		this._otg_manifest = null;
		this._otg_models = {};
		this._urns = [];
	}

	get host () { return ('https://cdn.derivative.autodesk.com'); }

	get urn () { return (this._urn); }
	set urn (urn) { this._urn = urn; }

	get manifest () { return (this._manifest); }
	set manifest (manifest) { this._manifest = manifest; }

	get otg_manifest () { return (this._otg_manifest); }
	set otg_manifest (manifest) { this._otg_manifest = manifest; }

	get account_id () { return (this.otg_manifest.account_id); }
	get project_id () { return (this.otg_manifest.project_id); }

	get global_root () { return (this.otg_manifest.paths.global_root); }
	get global_sharding () { return (this.otg_manifest.paths.global_sharding); }
	get version_root () { return (this.otg_manifest.paths.version_root); }
	get shared_root () { return (this.otg_manifest.paths.shared_root); }
	get region () { return (this.otg_manifest.paths.region); }

	get local_version_root () { return (path.join(this._outPath, this.otg_manifest.paths.version_root.substring(this.otg_manifest.paths.shared_root.length))); }
	get local_shared_root () { return (this._outPath); }
	set local_shared_root (outPath) { this._outPath = outPath; }
	get remote_root_path () { return (this.otg_manifest.paths.version_root.substring(this.otg_manifest.paths.shared_root.length)); }

	geometry_urn (viewId) { return (this.OTG_models[viewId].manifest.shared_assets.geometry); }
	materials_urn (viewId) { return (this.OTG_models[viewId].manifest.shared_assets.materials); }
	textures_urn (viewId) { return (this.OTG_models[viewId].manifest.shared_assets.textures); }

	local_geometry_root (viewId) { return (path.join(this._outPath, 'cdn', this.geometry_urn(viewId).substring(this.global_root.length))); }
	local_materials_root (viewId) { return (path.join(this._outPath, 'cdn', this.materials_urn(viewId).substring(this.global_root.length))); }
	local_textures_root (viewId) { return (path.join(this._outPath, 'cdn', this.textures_urn(viewId).substring(this.global_root.length))); }

	numFragments (viewId) { return (this.OTG_models[viewId].stats.num_fragments); }
	numPolys (viewId) { return (this.OTG_models[viewId].stats.num_polys); }
	numMaterials (viewId) { return (this.OTG_models[viewId].stats.num_materials); }
	numGeoms (viewId) { return (this.OTG_models[viewId].stats.num_geoms); }
	numTextures (viewId) { return (this.OTG_models[viewId].stats.num_textures); }

	// get OTG_models () { views.map ((elt) => { return (elt.urn) ; }) }
	// get OTG_models_keys () { Object.keys (otg_manifest.views) }
	get OTG_models () { return (this._otg_models); }
	set OTG_models (val) { this._otg_models = val; }

	downloadBubble (urn, outPath, token) {
		let self = this;
		self.local_shared_root = outPath;
		self.urn = urn;
		if (token) {
			self._token = new ForgeAPI.AuthClientTwoLegged('__', '__', ['data:read']);
			self._token.setCredentials({
				'token_type': 'Bearer',
				'expires_in': 1799,
				'access_token': token
			});
		} else {
			self._token = token.RW;
		}
		return (new Promise((fulfill, reject) => {
			self._progress.msg = 'Downloading manifest';
			self.getManifest(self.urn)
				// Collect and Analyze the Design manifest
				.then((bubble) => {
					self.manifest = bubble.body;
					// Code for GET /modeldata/manifest/{urn}
					self.otg_manifest = bubble.body.children.filter((elt) => { return (elt.role === 'viewable' && elt.otg_manifest); });
					if (self.otg_manifest.length !== 1)
						throw new Error('Unexpected OTG manifest format.');
					self.otg_manifest = self.otg_manifest[0].otg_manifest;

					// Code for GET /modeldata/otgmanifest/{urn}
					// self.otg_manifest =bubble.body ;

					// Save manifests
					let outFile = path.resolve(path.join(self.local_shared_root, self.remote_root_path, 'bubble.json'));
					utils.writeFile(outFile, bubble.body)
						.catch((err) => console.error('Error:', err.message));
					outFile = path.resolve(path.join(self.local_shared_root, self.remote_root_path, 'otg_manifest.json'));
					utils.writeFile(outFile, bubble.body.children[0].otg_manifest)
						.catch((err) => console.error('Error:', err.message));

					// Find each view Manifest, and linked files (like the AECModelData.json)
					self.OTG_models = {};
					let jobs = [];
					for (let [key, value] of Object.entries(self.otg_manifest.views)) {
						jobs.push(self.getViewModelManifest(self.version_root, value.urn, self.urn, self.local_version_root));
						if (value.role === 'graphics' && value.mime === 'application/autodesk-otg')
							self.OTG_models[key] = jobs.length - 1;
					}

					// Get placement.json file
					//outFile = path.resolve(path.join(self.local_shared_root, self.remote_root_path));
					//jobs.push(self.getViewModelManifest(self.version_root, 'placement.json', self.urn, outFile));
					return (Promise.all(jobs.map(p => p.catch(() => undefined))));
				})
				// Collect and Analyze each view otg_model.json
				.then((manifestsjson) => {
					self._urns = [];
					let jobs = [];
					// We only need to keep and proceed the otg_model.json files
					for (let [key, value] of Object.entries(self.OTG_models)) {
						self.OTG_models[key] = manifestsjson[value];
						let elt = manifestsjson[value];
						elt.jobs = [];
						elt.__dependencies__ = {};
						if (!elt.manifest || !elt.manifest.assets) // Unexpected OTG manifest format.
							continue;

						// otg_model.json|manifest.assets (fragments.fl fragments_extra.fl materials_ptrs.hl geometry_ptrs.hl texture_manifest.json pdb/avs.pack pdb/avs.idx pdb/dbid.idx)
						for (let [assetkey, asset] of Object.entries(elt.manifest.assets)) {
							// fragments.fl fragments_extra.fl materials_ptrs.hl geometry_ptrs.hl texture_manifest.json
							if (typeof asset === 'string') {
								let outFile = path.join(self.local_version_root, elt.__dirname__, asset);
								//elt.jobs.push (self.getViewModelFile (self.version_root, path.join (elt.__dirname__, asset), self.urn, outFile)) ;
								elt.jobs.push(function () { return ([self.getViewModelFile, arguments]); }(self.version_root, key, path.posix.join(elt.__dirname__, asset), self.urn, outFile));
								elt.__dependencies__[assetkey] = key + '%' + path.posix.join(elt.__dirname__, asset);
								continue;
							}
							// pdb/avs.pack pdb/avs.idx pdb/dbid.idx
							for (let [pdbkey, pdb] of Object.entries(asset)) {
								let st = path.join(self.local_version_root, elt.__dirname__, pdb);
								let outFile = path.join(path.dirname(st), /*pdbkey,*/ path.basename(st));
								st = path.posix.join(elt.__dirname__, pdb);
								if (self._urns.indexOf(self.version_root + st) !== -1)
									continue;
								self._urns.push(self.version_root + st);
								//elt.jobs.push (self.getViewModelFile (self.version_root, st, self.urn, outFile)) ;
								elt.jobs.push(function () { return ([self.getViewModelFile, arguments]); }(self.version_root, key, st, self.urn, outFile));
								elt.__dependencies__[pdbkey] = `${key}%${st}`;
							}
						}

						// otg_model.json|manifest.shared_assets (pdb/attrs.json pdb/vals.json pdb/ids.json)
						for (let [pdbkey, pdb] of Object.entries(elt.manifest.shared_assets.pdb)) {
							let st = path.posix.join(self.remote_root_path, elt.__dirname__, pdb);
							let outFile = path.join(self.local_version_root, elt.__dirname__, pdb);
							if (self._urns.indexOf(self.shared_root + st) !== -1)
								continue;
							self._urns.push(self.shared_root + st);
							//elt.jobs.push (self.getViewModelFile (self.shared_root, st, self.urn, outFile)) ;
							elt.jobs.push(function () { return ([self.getViewModelFile, arguments]); }(self.shared_root, key, st, self.urn, outFile));
							elt.__dependencies__[pdbkey] = `${key}%${st}`;
						}

						jobs = [...jobs, ...elt.jobs];
					}

					return (utils.promiseAllLimit(jobs, 10, (elt, index, arr) => utils.PromiseStatus(elt[0].apply(self, elt[1])))); // eslint-disable-line no-unused-vars
				})
				.then((results) => {
					let jobs = [];
					for (let [key, value] of Object.entries(self.OTG_models)) {
						for (let [asset, ijob] of Object.entries(value.__dependencies__)) { // eslint-disable-line no-unused-vars
							let result = results.filter(elt => elt[0] === value.__dependencies__[asset]);
							value.__dependencies__[asset] = result[0][1];
						}

						if (value.stats.num_materials) {
							let materialHashes = self.decomposeHashFile(value.__dependencies__.materials_ptrs, self.global_sharding);
							materialHashes = materialHashes.filter(elt => elt[0] !== '' && elt[1] !== '');
							materialHashes.map((elt) => {
								//self.getSharedAssetFile (self.materials_urn (key), elt, self.urn, self.local_materials_root (key)) ;
								jobs.push(function () { return ([self.getSharedAssetJson, arguments]); }(self.materials_urn(key), elt, self.urn, self.local_materials_root(key)));
								return (null);
							});
						}
						if (value.stats.num_geoms) {
							let geometryHashes = self.decomposeHashFile(value.__dependencies__.geometry_ptrs, self.global_sharding);
							geometryHashes = geometryHashes.filter(elt => elt[0] !== '' && elt[1] !== '');
							geometryHashes.map((elt) => {
								//self.getSharedAssetFile (self.geometry_urn (key), elt, self.urn, self.local_geometry_root (key)) ;
								jobs.push(function () { return ([self.getSharedAssetFile, arguments]); }(self.geometry_urn(key), elt, self.urn, self.local_geometry_root(key)));
								return (null);
							});
						}
						if (value.stats.num_textures && value.__dependencies__.hasOwnProperty('texture_manifest')) { // eslint-disable-line no-prototype-builtins
							for (let [fn, hash] of Object.entries(value.__dependencies__.texture_manifest)) { // eslint-disable-line no-unused-vars
								let elt = [
									hash.substring(0, self.global_sharding),
									hash.substring(self.global_sharding)
								];
								jobs.push(function () { return ([self.getSharedAssetFile, arguments]); }(self.textures_urn(key), elt, self.urn, self.local_textures_root(key)));
							}
						}
						//break;
					}

					return (utils.promiseAllLimit(jobs, 10, (elt, index, arr) => utils.PromiseStatus(elt[0].apply(self, elt[1])))); // eslint-disable-line no-unused-vars
				})
				.then((files) => { // eslint-disable-line no-unused-vars
					console.log('Download complete.');
				})
				.catch((err) => {
					console.error('Error:', err.message || err.statusMessage);
					self._errors.push(err.message || err.statusMessage);
					reject(self);
				});
		}));
	}

	getManifest (urn) {
		if (urn === undefined || urn === null)
			return (Promise.reject('Missing the required parameter {urn} when calling getManifest'));
		let ModelDerivative = new ForgeAPI.DerivativesApi();
		ModelDerivative.apiClient.basePath = this.host;
		return (ModelDerivative.apiClient.callApi(
			'/modeldata/manifest/{urn}', 'GET', // full manifest
			//'/modeldata/otgmanifest/{urn}', 'GET', // only OTG manifest
			{ urn: urn }, {}, { /*'Accept-Encoding': 'gzip, deflate'*/ pragma: 'no-cache' },
			{}, null,
			[], ['application/vnd.api+json', 'application/json'], null,
			this._token, this._token.getCredentials()
		));
	}

	getViewModelManifest (fileurn, elt, modelurn, outPath) {
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn || !modelurn)
				return (reject('Missing the required parameter {urn} when calling getManifest'));
			let ModelDerivative = new ForgeAPI.DerivativesApi();
			ModelDerivative.apiClient.basePath = host;
			ModelDerivative.apiClient.callApi(
				'/modeldata/file/' + encodeURIComponent(fileurn) + encodeURIComponent(elt), 'GET',
				{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
				{}, null,
				[], [ /*'application/vnd.api+json', 'application/json'*/], null,
				this._token, this._token.getCredentials()
			)
				.then((res) => {
					return (utils.gunzip(res.body));
				})
				.then((json) => {
					json.__dirname__ = path.dirname(elt);
					fulfill(json);

					let outFile = path.resolve(path.join(outPath, elt));
					console.log(' > ', outFile);
					return (utils.writeFile(outFile, json));
				})
				.catch((error) => {
					let outFile = path.join(outPath, elt);
					console.error(' !! ', outFile, ' (', error.statusMessage || error.message || '' , ')');
					reject(error);
				});
		}));
	}

	// Reference: https://zenhax.com/viewtopic.php?t=27
	static isGzip (buf) {
		return (buf[0] === 0x1f /*31*/ && buf[1] === 0x8b /*139*/);
	}

	getViewModelBinary (fileurn, key, elt, modelurn, outFile) {
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn || !modelurn)
				return (reject('Missing the required parameter {urn} when calling getViewModelBinary'));
			// Forge SDK and Unirest auto uncompress file :(
			// let req =unirest.get (host + path.posix.join ('/modeldata/file/', fileurn, encodeURI (elt)) + '?acmsession=' + modelurn)
			// 	.headers ({
			// 		'cache-control': 'no-cache',
			// 		pragma: 'no-cache',
			// 		//'Accept-Encoding': 'gzip, deflate',
			// 		Authorization: ('Bearer ' + this._token.getCredentials ().access_token)
			// 	});
			const options = {
				method: 'GET',
				hostname: host.replace(/http[s]*\:\/\//, ''),
				port: 443,
				path: ('/modeldata/file/' + encodeURIComponent(fileurn) + encodeURIComponent(elt) + '?acmsession=' + modelurn),
				headers: {
					'Authorization': ('Bearer ' + this._token.getCredentials().access_token),
					'cache-control': 'no-cache',
					pragma: 'no-cache',
				}
			};
			https.get(options, (res) => {
				//res.setEncoding('binary');
				let data = [];
				res
					.on('data', (chunk) => {
						data.push(chunk);
					})
					.on('end', () => { // eslint-disable-line no-unused-vars
						let buffer = Buffer.concat(data);
						if (buffer.slice(0, 5).toString() === '<?xml') {
							console.error(' !! ', outFile);
							reject(buffer.toString());
							return;
						}
						if (svf2Bubble.isGzip(buffer)) {
							utils.gunzip(buffer, true)
								.then((result) => {
									fulfill([`${key}%${elt}`, result]);
									console.log(' >> ', outFile, elt);
									utils.writeFile(outFile, result, 'binary', true);
								})
								.catch((err) => {
									console.error(err);
									reject(err);
								});
						} else {
							fulfill([`${key}%${elt}`, buffer]);
							console.log(' >> ', outFile);
							utils.writeFile(outFile, buffer, 'binary', true);
						}
					});

			});
		}));
	}

	getViewModelJson (fileurn, key, elt, modelurn, outFile) {
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn || !modelurn)
				return (reject('Missing the required parameter {urn} when calling getManifest'));
			let ModelDerivative = new ForgeAPI.DerivativesApi();
			ModelDerivative.apiClient.basePath = host;
			ModelDerivative.apiClient.callApi(
				'/modeldata/file/' + encodeURIComponent(fileurn) + encodeURIComponent(elt), 'GET',
				{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
				{}, null,
				[], ['application/json'], null,
				this._token, this._token.getCredentials()
			)
				.then((res) => {
					return (utils.gunzip(res.body, true));
				})
				.then((data) => {
					return (utils.writeFile(outFile, data, 'binary', true));
				})
				.then((data) => {
					console.log(' >> ', outFile);
					fulfill([`${key}%${elt}`, JSON.parse(data.toString('utf-8'))]);
				})
				.catch((error) => {
					console.error(' !! ', outFile);
					reject(error);
				});
		}));
	}

	getViewModelFile (fileurn, key, elt, modelurn, outFile) {
		if (path.extname(outFile) === '.json')
			return (this.getViewModelJson(fileurn, key, elt, modelurn, path.resolve(outFile)));
		else
			return (this.getViewModelBinary(fileurn, key, elt, modelurn, path.resolve(outFile)));
	}

	decomposeHashFile (content, sharding) {
		let byteStride = content[1] << 8 | content[0];
		if (byteStride % 4) {
			console.error(`Expected byte size to be multiple of 4, but got ${byteStride}`);
			return ([]);
		}
		//let version = content[3] << 8 | content[2];
		//let stride = byteStride / 4;
		let nb = content[5] << 8 | content[4];

		let bdata = new Uint8Array(byteStride);

		let results = [];
		for (let i = 1; i <= nb; i++) {
			//let streamOffset = i * byteStride;
			//let endOffset = streamOffset + byteStride;
			bdata.set(content.slice(i * byteStride, (i + 1) * byteStride));
			let st = Array.prototype.map.call(bdata, x => ('00' + x.toString(16)).slice(-2)).join('');
			results.push([st.slice(0, sharding), st.slice(sharding)]);
		}
		return (results);
	}

	getSharedAssetFile (fileurn, elt, modelurn, outPath) {
		let parts = fileurn.split('/');
		let account_id = parts[1];
		let type = parts[2];
		let outFile = path.resolve(path.join(outPath, type, elt[0], elt[1]));
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn)
				return (reject('Missing the required parameter {urn} when calling getSharedAssetFile'));
			if (outFile.endsWith('.png')) {
				let req = unirest.get(host + path.posix.join('/cdn/', elt[0], account_id, type, elt[1]) + '?acmsession=' + modelurn)
					.headers({
						pragma: 'no-cache',
						Authorization: ('Bearer ' + this._token.getCredentials().access_token)
					});
				if (outFile.endsWith('.png'))
					req.encoding('binary');
				req.send()
					.then((res) => {
						fulfill(res.body);
						console.log(' >> ', outFile);
						return (utils.writeFile(outFile, res.body, 'binary', true));
					})
					.catch((error) => {
						console.error(' !! ', outFile);
						reject(error);
					});
			} else {
				utils.fileexists(outFile)
					.then((bExists) => {
						if (bExists && elt[0] !== 5000)
							return (fulfill(outFile));
						const options = {
							method: 'GET',
							hostname: host.replace(/http[s]*\:\/\//, ''),
							port: 443,
							path: (path.posix.join('/cdn/', elt[0], account_id, type, elt[1]) + '?acmsession=' + modelurn),
							headers: {
								'Authorization': ('Bearer ' + this._token.getCredentials().access_token),
								'cache-control': 'no-cache',
								pragma: 'no-cache',
							}
						};
						https.get(options, (res) => {
							//res.setEncoding('binary');
							let data = [];

							res.on('data', (chunk) => {
								data.push(chunk);
							}).on('end', () => {
								let buffer = Buffer.concat(data);
								if (buffer.slice(0, 5).toString() === '<?xml') {
									console.error(' !! ', outFile);
									reject(buffer.toString());
									return;
								}
								//utils.writeFile(outFile + '.gz', buffer, 'binary', true)
								svf2Bubble.gunzip(buffer, true)
									.then((result) => {
										fulfill(result);
										console.log(' >> ', outFile);
										return (utils.writeFile(outFile, result, 'binary', true));
									})
									.catch((error) => {
										console.error(' !! ', outFile);
										reject(error);
									});
							});
						});
					});
			}
		}));
	}

	getSharedAssetJson (fileurn, elt, modelurn, outPath) {
		let parts = fileurn.split('/');
		let account_id = parts[1];
		let type = parts[2];
		let outFile = path.resolve(path.join(outPath, type, elt[0], elt[1]));
		const host = this.host;
		return (new Promise((fulfill, reject) => {
			if (!fileurn)
				return (reject('Missing the required parameter {urn} when calling getSharedAssetJson'));
			utils.fileexists(outFile)
				.then((bExists) => {
					if (bExists)
						return (fulfill(outFile));
					let ModelDerivative = new ForgeAPI.DerivativesApi();
					ModelDerivative.apiClient.basePath = host;
					ModelDerivative.apiClient.callApi(
						path.posix.join('/cdn/', elt[0], account_id, type, elt[1]), 'GET',
						{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
						{}, null,
						[], ['application/json'], null,
						this._token, this._token.getCredentials()
					)
						.then((res) => {
							return (utils.gunzip(res.body));
						})
						.then((json) => {
							fulfill(json);
							console.log(' >> ', outFile);
							return (utils.writeFile(outFile, json));
						})
						.catch((error) => {
							console.error(' !! ', outFile);
							reject(error);
						});
				});
		}));
	}

	static gunzip (res, bRaw = false) {
		return (new Promise((fulfill, reject) => { // eslint-disable-line no-unused-vars
			zlib.gunzip(res, (err, dezipped) => {
				if (err)
					return (fulfill(res));
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

}

//let bubbleUtils ={
// GenerateStartupFiles: (bubble, identifier) => {
// 	return (new Promise ((fulfill, reject) => {
// 		fs.createReadStream (utils.path ('views/readme.txt'))
// 			.pipe (fs.createWriteStream (utils.path ('data/' + identifier + '/readme.txt'))) ;
// 		fs.createReadStream (utils.path ('views/bat.ejs'))
// 			.pipe (fs.createWriteStream (utils.path ('data/' + identifier + '/index.bat'))) ;
// 		let ws =fs.createWriteStream (utils.path ('data/' + identifier + '/index')) ;
// 		fs.createReadStream (utils.path ('views/bash.ejs'))
// 			.pipe (ws) ;
// 		ws.on ('finish', () => {
// 			if ( /^win/.test (process.platform) === false )
// 				fs.chmodSync (utils.path ('data/' + identifier + '/index'), 0777) ;
// 		}) ;
// 		utils.readFile (utils.path ('views/view.ejs'), 'utf-8')
// 			.then ((st) => {
// 				let data =ejs.render (st, { docs: bubble._viewables }) ;
// 				let fullnameHtml =utils.path ('data/' + identifier + '/index.html') ;
// 				return (utils.writeFile (fullnameHtml, data, 'utf-8')) ;
// 			})
// 			.then ((st) => {
// 				fulfill (bubble) ;
// 			})
// 			.catch ((error) => {
// 				reject (error) ;
// 			})
// 		;
// 	})) ;
// },
//
// AddViewerFiles: (bubble, identifier) => {
// 	return (new Promise ((fulfill, reject) => {
// 		let urns =viewerFileList.map ((item) => {
// 			return (bubbleUtils.DownloadViewerItem ('/derivativeservice/v2/viewers/' + item, bubble._outPath, item)) ;
// 		}) ;
// 		Promise.all (urns)
// 			.then ((urns) => {
// 				let bower =utils.path ('www/bower_components') ;
// 				let data =utils.path ('data/' + identifier) ;
// 				fs.createReadStream (bower + '/jquery/dist/jquery.min.js')
// 					.pipe (fs.createWriteStream (data + '/jquery.min.js')) ;
// 				fs.createReadStream (bower + '/jquery-ui/jquery-ui.min.js')
// 					.pipe (fs.createWriteStream (data + '/jquery-ui.min.js')) ;
// 				fulfill (bubble) ;
// 			})
// 			.catch ((error) => {
// 				console.error ('Something wrong happened during viewer files download') ;
// 				reject (error) ;
// 			})
// 		;
// 	})) ;
// },
//
// DownloadViewerItem: (uri, outPath, item) => {
// 	uri +='?v=v' + (config ? config.viewerVersion : '2.17') ;
// 	return (new Promise ((fulfill, reject) => {
// 		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
// 		ModelDerivative.apiClient.callApi (
// 			uri, 'GET',
// 			{}, {}, {},
// 			{}, null,
// 			[], [ 'application/octet-stream', 'image/png', 'text/html', 'text/css', 'text/javascript', 'application/json' ], null,
// 			forgeToken.RW, forgeToken.RW.getCredentials ()
// 		)
// 			.then ((response) => {
// 				//console.log (response.headers ['content-type'], item) ;
// 				let body =response.body ;
// 				if (   response.headers ['content-type'] == 'text/javascript'
// 					|| response.headers ['content-type'] == 'text/css'
// 				)
// 					body =response.body.toString ('utf8') ;
// 				if (   response.headers ['content-type'] == 'application/json'
// 					|| response.headers ['content-type'] == 'application/json; charset=utf-8'
// 				)
// 					body =JSON.stringify (response.body) ;
// 				console.log ('Downloaded:', outPath + item) ;
// 				return (utils.writeFile (outPath + item, body, null, true)) ;
// 			})
// 			.then ((response) => {
// 				fulfill (item) ;
// 			})
// 			.catch ((error) => {
// 				console.error (error) ;
// 				reject (error) ;
// 			})
// 		;
// 	})) ;
// },
//
// PackBubble: (inDir, outZip) => {
// 	return (new Promise ((fulfill, reject) => {
// 		try {
// 			//let zip =new AdmZip () ;
// 			//zip.addLocalFolder (inDir) ;
// 			//zip.writeZip (outZip, (error, result) => {
// 			//	if ( error )
// 			//		reject (error) ;
// 			//	else
// 			//		fulfill (outZip) ;
// 			//}) ;
//
// 			let archive =archiver ('zip') ;
// 			archive.on ('error', (err) => {
// 				console.error ('PackBubble: ' + err) ;
// 				//reject (err) ;
// 			}) ;
// 			archive.on ('finish', (err) => {
// 				if ( err ) {
// 					console.error ('PackBubble: ' + err) ;
// 					reject (err) ;
// 				} else {
// 					console.log ('PackBubble ended successfully.') ;
// 					fulfill (outZip) ;
// 				}
// 			}) ;
//
// 			let output =fs.createWriteStream (outZip) ;
// 			archive.pipe (output) ;
// 			archive.directory (inDir, '') ;
// 			archive.finalize () ;
// 		} catch ( ex ) {
// 			reject (ex) ;
// 		}
// 	})) ;
// },
//
// NotifyPeopleOfSuccess: (identifier, locks) => {
// 	return (bubbleUtils.NotifyPeople (identifier, locks, utils.path ('views/email-extract-succeeded.ejs'), 'Autodesk Forge Viewer Extractor notification')) ;
// },
//
// NotifyPeopleOfFailure: (identifier, locks, error) => {
// 	return (bubbleUtils.NotifyPeople (identifier, locks, utils.path ('views/email-extract-failed.ejs'), 'Autodesk Forge Viewer Extractor failure')) ;
// },
//
// NotifyPeople: (identifier, locks, template, subject) => {
// 	return (new Promise ((fulfill, reject) => {
// 		utils.readFile (template, 'utf-8')
// 			.then ((st) => {
// 				let data =ejs.render (st, { ID: identifier }) ;
// 				sendMail ({
// 					'from': 'ADN Sparks <adn.sparks@autodesk.com>',
// 					'replyTo': 'adn.sparks@autodesk.com',
// 					'to': locks,
// 					'subject': subject,
// 					'html': data,
// 					'forceEmbeddedImages': true
// 				}) ;
// 				fulfill () ;
// 			})
// 			.catch ((error) => {
// 				console.error (error) ;
// 				reject (error) ;
// 			})
// 		;
// 	})) ;
// }
//
// } ;

module.exports = {
	svf: svfBubble,
	svf2: svf2Bubble,
	otg: otgBubble,
	//utils: bubbleUtils
};
