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

const ForgeAPI = require('forge-apis');
const fs = require('fs');
const url = require('url');
const path = require('path');
const uuidv4 = require('uuid/v4');
const utils = require('./utils');

class Forge_OSS {

	static get oauth () { return (Forge_OSS._oauth); }
	static set oauth (val) { Forge_OSS._oauth = val; }
	static get chunkSize () { return (Forge_OSS._chunkSize); }
	static set chunkSize (val) { Forge_OSS._chunkSize = val; }
	static get minChunkSize () { return (Forge_OSS._minChunkSize); }
	static set minChunkSize (val) { Forge_OSS._minChunkSize = val; }

	// buckets (2legged)
	static bucketsList (options) {
		let limit = options.limit || options.parent.limit || 10;
		let startAt = options.startAt || options.parent.startAt || null;
		let region = options.region || options.parent.region || 'US';
		let opts = { 'limit': limit, 'startAt': startAt, 'region': region };
		console.log('Listing from ' + (startAt || 'beginning') + ' to ' + limit);
		Forge_OSS.oauth.getOauth2Legged()
			.then((oa2legged) => {
				let ossBuckets = new ForgeAPI.BucketsApi();
				return (ossBuckets.getBuckets(opts, oa2legged, oa2legged.getCredentials()));
			})
			.then((buckets) => {
				console.log(JSON.stringify(buckets.body.items, null, 4));
				if (!buckets.body.hasOwnProperty('next')) { // eslint-disable-line no-prototype-builtins
					console.log('Your search is complete, no more items to list');
				} else {
					let url_parts = url.parse(buckets.body.next, true);
					let _startAt = url_parts.query.startAt;
					console.log('Your next search startAt is: ' + _startAt);
				}
			})
			.catch((error) => {
				console.error('Failed to get bucket list!', error);
			});
	}

	static bucketsCurrent (bucketKey, options) { // eslint-disable-line no-unused-vars
		if (bucketKey && bucketKey !== '') {
			Forge_OSS.checkBucketKey(bucketKey)
				.then((_bucketKey) => {
					return (utils.writeFile(utils.data('bucket'), _bucketKey));
				})
				.then((data) => { // eslint-disable-line no-unused-vars
					console.log('You set the current bucket to: ' + bucketKey);
				})
				.catch((error) => {
					console.error('Failed to create bucket file', error);
				});
		} else {
			Forge_OSS.readBucketKey()
				.then((data) => {
					console.log('The current bucket is: ' + data);
				})
				.catch((error) => {
					console.error('No bucket defined by default', error);
				});
		}
	}

	static bucketsNew (bucketKey, type, options) {
		type = type || 'persistent';
		let region = options.region || options.parent.region || 'US';
		let authid = options.authid || options.parent.authid || null;
		let access = options.access || options.parent.access || 'full';
		Forge_OSS.checkBucketKey(bucketKey)
			.then((_bucketKey) => {
				console.log('Creating bucket: ' + _bucketKey);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((oa2legged) => {
				let ossBuckets = new ForgeAPI.BucketsApi();
				let opts = {
					bucketKey: bucketKey,
					policyKey: type
				};
				if (authid && access)
					opts.allow = { authid: authid, access: access };
				let headers = {
					'xAdsRegion': region
				};
				return (ossBuckets.createBucket(opts, headers, oa2legged, oa2legged.getCredentials()));
			})
			.then((bucket) => {
				console.log('bucket created');
				console.log(JSON.stringify(bucket.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while creating your bucket!', error);
			});
	}

	static bucketsDelete (bucketKey, options) { // eslint-disable-line no-unused-vars
		Forge_OSS.checkBucketKey(bucketKey)
			.then((name) => { // eslint-disable-line no-unused-vars
				console.log('Deleting bucket: ' + bucketKey);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((oa2legged) => {
				let ossBuckets = new ForgeAPI.BucketsApi();
				return (ossBuckets.deleteBucket(bucketKey, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => { // eslint-disable-line no-unused-vars
				utils.unlink(utils.data('bucket'));
				console.log('bucket deleted');
			})
			.catch((error) => {
				console.error('Something went wrong while deleting your bucket!', error);
			});
	}

	static bucketsInfo (bucketKey, options) { // eslint-disable-line no-unused-vars
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Getting bucket information: ' + name);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((oa2legged) => {
				let ossBuckets = new ForgeAPI.BucketsApi();
				return (ossBuckets.getBucketDetails(bucketKey, oa2legged, oa2legged.getCredentials()));
			})
			.then((info) => {
				console.log(JSON.stringify(info.body, null, 4));
				let data = info.body;
				if (data.policyKey === 'transient') // 24 hours
					console.log('bucket content will expire after: 24 hours');
				else if (data.policyKey === 'temporary') // 30 days
					console.log('bucket content will expire after: 30 days');
				else // persistent
					console.log('bucket content will never expire');
			})
			.catch((error) => {
				console.error('Something went wrong while requesting information on your bucket!', error);
			});
	}

	static bucketsLs (bucketKey, options) {
		let limit = options.limit || options.parent.limit || 10;
		let startAt = options.startAt || options.parent.startAt || null;
		let beginsWith = options.beginsWith || options.parent.beginsWith || null;
		let opts = { 'limit': limit, 'startAt': startAt, 'beginsWith': beginsWith };
		console.log('Listing from ' + (startAt || 'beginning') + ' to ' + limit);
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Listing bucket content: ' + bucketKey);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((oa2legged) => {
				let ossObjects = new ForgeAPI.ObjectsApi();
				return (ossObjects.getObjects(bucketKey, opts, oa2legged, oa2legged.getCredentials()));
			})
			.then((info) => {
				console.log(JSON.stringify(info.body.items, null, 4));
				if (!info.body.hasOwnProperty('next')) { // eslint-disable-line no-prototype-builtins
					console.log('Your search is complete, no more items to list');
				} else {
					let url_parts = url.parse(info.body.next, true);
					let _startAt = url_parts.query.startAt;
					console.log('Your next search startAt is: ' + _startAt);
				}
			})
			.catch((error) => {
				console.error('Something went wrong while listing your bucket content!', error);
			});
	}

	// objects (2legged)
	static objectsInfo (filename, options) {
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_OSS.key2filename(filename);
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Getting information on object: ' + name + ' - ' + filename);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((oa2legged) => {
				let ossObjects = new ForgeAPI.ObjectsApi();
				return (ossObjects.getObjectDetails(bucketKey, filename, {}, oa2legged, oa2legged.getCredentials()));
			})
			.then((info) => {
				console.log(JSON.stringify(info.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while getting information on your object!', error);
			});
	}

	// be careful this method is not appropriate for large file as it copies everything in memory
	// before dumping to a file :()
	// i.e.
	//		.then ((oa2legged) => {
	//			let ossObjects =new ForgeAPI.ObjectsApi () ;
	//			return (ossObjects.getObject (bucketKey, filename, {}, oa2legged, oa2legged.getCredentials  ())) ;
	//		})
	//		.then ((result) => {
	// 			...
	// Instead, we will check the file size before downloading samller chunks

	// Example to d/l the file at once
	static objectsGet_full (oa2legged, bucketKey, filename, wstream) {
		return (new Promise((fulfill, reject) => {
			let ossObjects = new ForgeAPI.ObjectsApi();
			ossObjects.getObject(bucketKey, filename, {}, oa2legged, oa2legged.getCredentials())
				.then((result) => {
					wstream.write(result.body, () => {
						//console.log ('Write completed.') ;
						fulfill(result);
					});
				})
				.catch((error) => {
					reject(error);
				});
		}));
	}

	static objectsGet (filename, outputFile, options) {
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_OSS.key2filename(filename);
		let oa2legged = null;
		let ossObjects = new ForgeAPI.ObjectsApi();
		let wstream = null;
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Downloading object from oss: ' + name + ' - ' + filename);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				return (ossObjects.getObjectDetails(bucketKey, filename, {}, oa2legged, oa2legged.getCredentials()));
			})
			.then((info) => {
				let size = info.body.size;
				if (size <= 0)
					throw new Error('Object size is empty!');
				wstream = fs.createWriteStream(outputFile);
				if (size <= Forge_OSS.chunkSize)
					return (Forge_OSS.objectsGet_full(oa2legged, bucketKey, filename, wstream));
				let nb = Math.floor(size / Forge_OSS.chunkSize);
				if ((size % Forge_OSS.chunkSize) !== 0)
					nb++;
				let arr = [];
				for (let i = 0; i < nb; i++) {
					let start = i * Forge_OSS.chunkSize;
					let end = start + Forge_OSS.chunkSize - 1;
					if (end > size - 1)
						end = size - 1;
					let opts = {
						range: 'bytes=' + start + '-' + end
					};
					//console.log ('Requesting object range - ' + opts.range) ;

					// Still in parallel, but results processed in series with 'utils.promiseSerie'
					//arr.push (ossObjects.getObject (bucketKey, filename, opts, oa2legged, oa2legged.getCredentials ())) ;

					arr.push({ opts: opts, bucketKey: bucketKey, filename: filename, oa2legged: oa2legged });
				}

				return (utils.promiseSerie(arr, (item, index) => { // eslint-disable-line no-unused-vars
					return (new Promise((fulfill, reject) => {
						// If still in parallel, but results processed in series with 'utils.promiseSerie', use item.then()

						ossObjects.getObject(item.bucketKey, item.filename, item.opts, item.oa2legged, item.oa2legged.getCredentials())
							.then((content) => {
								//content.headers ['accept-ranges'] === 'bytes'
								wstream.write(content.body, () => {
									console.log('Received chunk - ' + content.headers['content-range']);
									fulfill(content.headers['content-range']);
								});
							})
							.catch((error) => {
								reject(error);
							});
					}));
				}));
				// return (ossObjects.getObject (bucketKey, filename, {}, oa2legged, oa2legged.getCredentials ())) ; // full file
			})
			.then((results) => { // eslint-disable-line no-unused-vars
				wstream.end();
				console.log('Your object is ready at: ' + outputFile);
			})
			.catch((error) => {
				console.error('Something went wrong while downloading your object!', error);
				if (wstream)
					wstream.end();
				utils.unlink(outputFile);
			});
	}

	// Example to u/l the file at once
	static objectsPut_full (oa2legged, bucketKey, ossname, size, rstream) {
		return (new Promise((fulfill, reject) => {
			let ossObjects = new ForgeAPI.ObjectsApi();
			ossObjects.uploadObject(bucketKey, ossname, size, rstream, {}, oa2legged, oa2legged.getCredentials())
				.then((result) => {
					fulfill(result);
				})
				.catch((error) => {
					reject(error);
				});
		}));
	}

	static objectsPut (filename, options) {
		let bucketKey = options.bucket || options.parent.bucket || null;
		let strippath = options.strippath || options.parent.strippath || false;
		let ossname = filename;
		if (strippath)
			ossname = path.basename(filename);
		let oa2legged = null;
		let ossObjects = new ForgeAPI.ObjectsApi();
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Uploading object to oss: ' + name + ' - ' + filename);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				return (utils.filesize(filename));
			})
			.then((size) => {
				if (size <= 0)
					throw new Error('Object size is empty!');
				if (size <= Forge_OSS.chunkSize) {
					let rstream = fs.createReadStream(filename);
					return (Forge_OSS.objectsPut_full(oa2legged, bucketKey, ossname, size, rstream));
				}
				let nb = Math.floor(size / Forge_OSS.chunkSize);
				if ((size % Forge_OSS.chunkSize) !== 0)
					nb++;
				let arr = [];
				let uuid = uuidv4();
				for (let i = 0; i < nb; i++) {
					let start = i * Forge_OSS.chunkSize;
					let end = start + Forge_OSS.chunkSize - 1;
					if (end > size - 1)
						end = size - 1;
					let opts = {
						ContentRange: 'bytes ' + start + '-' + end + '/' + size,
						size: end - start + 1,
						start: start,
						end: end
					};

					// Still in parallel, but results processed in series with 'utils.promiseSerie'
					//arr.push (ossObjects.uploadChunk (bucketKey, ossname, chunkSize, opts.ContentRange, sessionId, rstream, {}, oa2legged, oa2legged.getCredentials ())) ;

					arr.push({ opts: opts, bucketKey: bucketKey, ossname: ossname, sessionId: uuid, oa2legged: oa2legged });
				}

				return (utils.promiseSerie(arr, (item, index) => { // eslint-disable-line no-unused-vars
					return (new Promise((fulfill, reject) => {
						// If still in parallel, but results processed in series with 'utils.promiseSerie', use item.then()

						//console.log (JSON.stringify (item, null, 4)) ;
						let rstream = fs.createReadStream(filename, { start: item.opts.start, end: item.opts.end });
						ossObjects.uploadChunk(item.bucketKey, item.ossname, item.opts.size, item.opts.ContentRange, item.sessionId, rstream, {}, item.oa2legged, item.oa2legged.getCredentials())
							.then((content) => {
								console.log('Chunk ' + item.opts.ContentRange + ' accepted...');
								if (content.statusCode === 202)
									return (fulfill(item.opts.ContentRange));
								fulfill(content);
							})
							.catch((error) => {
								reject(error);
							});
					}));
				}));

			})
			.then((info) => {
				if (Array.isArray(info))
					info = info.pop();
				console.log(JSON.stringify(info.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while uploading your object!', error);
			});
	}

	static objectsCopy (filename, target, options) {
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key) {
			filename = Forge_OSS.key2filename(filename);
			target = Forge_OSS.key2filename(target);
		}

		let oa2legged = null;
		let ossObjects = new ForgeAPI.ObjectsApi();
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Copying object from oss: ' + name + ' - ' + filename + ' to ' + target);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				return (ossObjects.copyTo(bucketKey, filename, target, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => {
				console.log(JSON.stringify(response.body, null, 4));
				console.log('Your object has been copied');
			})
			.catch((error) => {
				console.error('Something went wrong while copying your object!', error);
			});
	}

	static objectsDelete (filename, options) {
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_OSS.key2filename(filename);

		let oa2legged = null;
		let ossObjects = new ForgeAPI.ObjectsApi();
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Deleting object from oss: ' + name + ' - ' + filename);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				return (ossObjects.deleteObject(bucketKey, filename, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => { // eslint-disable-line no-unused-vars
				//console.log (JSON.stringify (response.body, null, 4)) ;
				console.log('Your object has been deleted');
			})
			.catch((error) => {
				console.error('Something went wrong while deleting your object!', error);
			});
	}

	static signObject (filename, options) {
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_OSS.key2filename(filename);

		let access = options.access || options.parent.access || 'read';
		let postBucketsSigned = {
			singleUse: (options.singleuse || options.parent.singleuse || false),
			minutesExpiration: parseInt(options.minutesexpiration || options.parent.minutesexpiration || 60)
		};

		let oa2legged = null;
		let ossObjects = new ForgeAPI.ObjectsApi();
		Forge_OSS.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				console.log('Sign object in/from oss: ' + name + ' - ' + filename);
				return (Forge_OSS.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				return (ossObjects.createSignedResource(bucketKey, filename, postBucketsSigned, { access: access }, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => { // eslint-disable-line no-unused-vars
				console.log (JSON.stringify (response.body, null, 4)) ;
				console.log('Your object has been signed');
			})
			.catch((error) => {
				console.error('Something went wrong while signing your object!', error);
			});
	}

	static unsignObject (id, options) {
		let region = options.region || options.parent.region || 'US';

		let oa2legged = null;
		let ossObjects = new ForgeAPI.ObjectsApi();
		Forge_OSS.oauth.getOauth2Legged()
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				return (ossObjects.deleteSignedResource(id, { region: region }, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => { // eslint-disable-line no-unused-vars
				console.log(response.body);
				console.log('Your object has been unsigned');
			})
			.catch((error) => {
				console.error('Something went wrong while unsigning your object!', error);
			});
	}

	static readBucketKey (bucketKeyDefault) {
		return (new Promise((fulfill, reject) => {
			if (bucketKeyDefault !== undefined && bucketKeyDefault !== null && bucketKeyDefault !== '') {
				Forge_OSS.checkBucketKey(bucketKeyDefault)
					.then((content) => {
						fulfill(content);
					})
					.catch((error) => {
						reject(error);
					});
			} else {
				utils.readFile(utils.data('bucket'), 'utf-8')
					.then((content) => {
						fulfill(content);
					})
					.catch((error) => {
						reject(error);
					});
			}
		}));
	}

	static checkBucketKey (name) {
		return (new Promise((fulfill, reject) => {
			let p = /^[-_.a-z0-9]{3,128}$/;
			let result = p.test(name);
			if (!result)
				reject(new Error('Invalid bucket name'));
			else
				fulfill(name);
		}));
	}

	static filename2key (filename, bFilenameOnly) {
		if (bFilenameOnly === true)
			return (encodeURIComponent(path.basename(filename)));
		return (encodeURIComponent(filename));
	}

	static key2filename (key, pathname) {
		let filename = decodeURIComponent(key);
		if (pathname)
			return (path.join(pathname, filename));
		return (filename);
	}

	static createOSSURN (bucketKey, filename, bEncode) {
		bEncode = bEncode || false;
		let urn = 'urn:adsk.objects:os.object:' + bucketKey + '/' + Forge_OSS.filename2key(filename);
		if (bEncode)
			urn = utils.safeBase64encode(urn);
		return (urn);
	}

}

module.exports = Forge_OSS;
