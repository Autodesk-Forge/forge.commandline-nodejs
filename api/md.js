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
/*jshint esversion: 9 */

const ForgeAPI = require('forge-apis');
const _path = require('path');
const utils = require('./utils');

class Forge_MD {

	static get oauth () {
		return (Forge_MD._oauth);
	}

	static set oauth (val) {
		Forge_MD._oauth = val;
	}

	static async objectsTranslate (filename, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);
		let master = options.master || options.parent.master || null;
		let force = options.force || options.parent.force || false;
		let references = options.references || options.parent.references || false;
		let ifcRevit = options.ifcRevit || options.parent.ifcRevit || false;
		let ifcNavis = options.ifcNavis || options.parent.ifcNavis || false;
		let generateMasterViews = options.generateMasterViews || options.parent.generateMasterViews || false;
		let region = options.region || options.parent.region || 'US';
		let compressed = (_path.extname(filename).toLowerCase() === '.zip' || _path.extname(filename).toLowerCase() === '.rar');
		if (compressed && master === null)
			return (console.error('You must provide a master file reference!'));

		let oa2legged = null;
		let jobs = null;
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				let urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				jobs = {
					input: {
						urn: urn
					},
					output: {
						destination: {
							region: region
						},
						formats: [
						]
					}
				};
				if (compressed) {
					jobs.input.compressedUrn = compressed;
					jobs.input.rootFilename = master;
				}
				if (references)
					jobs.input.checkReferences = true;

				let svf = options.svf || options.parent.svf || false;
				if (svf) {
					jobs.output.formats.push({
						type: 'svf',
						views: [
							'2d',
							'3d'
						]
					});
					jobs.output.advanced = {
						generateMasterViews: generateMasterViews
					};

					ifcRevit && (jobs.output.advanced.conversionMethod = 'modern');
					ifcNavis && (jobs.output.advanced.conversionMethod = 'legacy');
				}

				let svf2 = options.svf2 || options.parent.svf2 || false;
				if (svf2) {
					jobs.output.formats.push({
						type: 'svf2',
						views: [
							'2d',
							'3d'
						]
					});
					jobs.output.advanced = {
						generateMasterViews: generateMasterViews
					};

					ifcRevit && (jobs.output.advanced.conversionMethod = 'modern');
					ifcNavis && (jobs.output.advanced.conversionMethod = 'legacy');
				}

				let stl = options.stl || options.parent.stl || false;
				let ascii = options.ascii || options.parent.ascii || false;
				let fs = options.fs || options.parent.fs || false;
				if (stl)
					jobs.output.formats.push({
						type: 'stl',
						advanced: {
							format: (ascii ? 'ascii' : 'binary'),
							exportColor: (options.colors || options.parent.colors || false),
							exportFileStructure: (fs ? 'multiple' : 'single')
						}
					});

				let step = options.step || options.parent.step || false;
				if (step)
					jobs.output.formats.push({
						type: 'step',
						advanced: {
							applicationProtocol: (options.protocol || options.parent.protocol || '214'),
							tolerance: (options.tolerance || options.parent.tolerance || 0.001)
						}
					});

				let iges = options.iges || options.parent.iges || false;
				if (iges)
					jobs.output.formats.push({
						type: 'iges',
						advanced: {
							surfaceType: (options.surfaceType || options.parent.surfaceType || 'bounded'),
							sheetType: (options.sheetType || options.parent.sheetType || 'surface'),
							solidType: (options.solidType || options.parent.solidType || 'solid'),
							tolerance: (options.tolerance || options.parent.tolerance || 0.001)
						}
					});

				let fbx = options.fbx || options.parent.fbx || false;
				if (fbx)
					jobs.output.formats.push({
						type: 'fbx'
					});

				let dwg = options.dwg || options.parent.dwg || false;
				if (dwg)
					jobs.output.formats.push({
						type: 'dwg'
					});

				let ifc = options.ifc || options.parent.ifc || false;
				if (ifc)
					jobs.output.formats.push({
						type: 'ifc'
					});

				let obj = options.obj || options.parent.obj || false;
				let ids = options.ids || options.parent.ids || [-1];
				if (!Array.isArray(ids)) {
					ids = ids.split(',');
					ids = ids.map(elt => parseInt(elt));
				}
				let unit = options.unit || options.parent.unit || null;
				let guid = options.guid || options.parent.guid || null;
				if (obj)
					jobs.output.formats.push({
						type: 'obj',
						advanced: {
							exportFileStructure: (fs ? 'multiple' : 'single'),
							unit: unit,
							modelGuid: guid,
							objectIds: ids
						}
					});

				//console.log (JSON.stringify (jobs, null, 2)) ;
				return (jobs);
			})
			.then((_jobs) => {
				if (_jobs.output.formats.length === 0)
					throw new Error('Please specify an output format');

				let md = new ForgeAPI.DerivativesApi();
				return (md.translate(_jobs, { xAdsForce: force }, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => {
				console.log(JSON.stringify(response.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while requesting translation for your seed file!', error);
			});
	}

	static async objectsReferences (filename, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);
		let args = options.rawArgs || options.parent.rawArgs || null;
		if (!args)
			return (null);
		let oa2legged = null;
		let jobs = null;
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				let urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				//let decoded = utils.safeBase64decode (urn);
				let baseURN = 'urn:adsk.objects:os.object:' + bucketKey + '/';
				let references = {
					urn: baseURN + filename,
					filename: filename
				};
				// Collect Masters/Childs
				let dict = {};
				let master = filename;
				dict[master] = [];
				for (let i = 4; i < args.length; i++) {
					if (args[i] === '--child') {
						let childs = args[++i].split(',');
						for (let j = 0; j < childs.length; j++)
							dict[master].push(childs[j]);
					} else if (args[i] === '--master') {
						master = args[++i];
						dict[master] = [];
					}
				}
				// Build references payload
				function buildReferenceTree (refDict, entry) {
					if (!refDict.hasOwnProperty(entry))
						return (null);
					let result = [];
					for (let i = 0; i < refDict[entry].length; i++) {
						let ref = {
							urn: baseURN + refDict[entry][i],
							relativePath: refDict[entry][i]
						};
						let subref = buildReferenceTree(refDict, refDict[entry][i]);
						if (subref !== null)
							ref.references = subref;
						result.push(ref);
					}
					return (result);
				}

				references.references = buildReferenceTree(dict, filename);
				return ({ urn: urn, references: references });
			})
			.then((_result) => {
				let md = new ForgeAPI.DerivativesApi();
				return (md.setReferences(_result.urn, _result.references, {}, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => {
				console.log(JSON.stringify(response.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while setting translation references for your seed file!', error);
			});
	}

	static async objectsTranslateStatus (filename, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);

		let oa2legged = null;
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				let urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				let md = new ForgeAPI.DerivativesApi();
				return (md.getManifest(urn, {}, oa2legged, oa2legged.getCredentials()));
			})
			.then((manifest) => {
				//console.log (JSON.stringify (manifest.body, null, 4)) ;
				manifest = manifest.body;
				console.log(manifest.status + ' - ' + manifest.progress);
				if (manifest.region)
					console.log('Region: ' + manifest.region);
				if (manifest.version)
					console.log('Version: ' + manifest.version);
				for (let i = 0; manifest.derivatives && i < manifest.derivatives.length; i++) {
					let derivative = manifest.derivatives[i];
					if (derivative.overrideOutputType)
						console.log(`\t${derivative.outputType} [${derivative.overrideOutputType}]: ${derivative.status} - ${derivative.progress}`);
					else
						console.log(`\t${derivative.outputType}: ${derivative.status} - ${derivative.progress}`);
					for (let k = 0; derivative.children && k < derivative.children.length; k++) {
						let child = derivative.children[k];
						console.log('\t\t' + child.type + ', ' + child.role + ': ' + child.status + ' - ' + (child.progress || derivative.progress));
					}
				}
			})
			.catch((error) => {
				console.error('Something went wrong while requesting translation status for your seed file!', error);
			});
	}

	static async objectsManifest (filename, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);
		let deleteOption = options.delete || options.parent.delete || false;
		let svf = options.svf || options.parent.svf || false;

		let oa2legged = null;
		let urn = '';
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				let md = new ForgeAPI.DerivativesApi();
				if (deleteOption)
					return (md.deleteManifest(urn, oa2legged, oa2legged.getCredentials()));
				else
					return (md.getManifest(urn, {}, oa2legged, oa2legged.getCredentials()));
			})
			.then((manifest) => {
				manifest = manifest.body;
				console.log(JSON.stringify(manifest, null, 4));

				for (let i = 0; manifest.derivatives && i < manifest.derivatives.length; i++) {
					let derivative = manifest.derivatives[i];
					if (derivative.outputType === 'svf2' && svf ) {
						let apiClient = ForgeAPI.ApiClient.instance;
						return (apiClient.callApi(
							'/derivativeservice/v2/manifest/{urn}', 'GET',
							{ urn: urn }, {}, {}, {}, null,
							['application/json'], ['application/vnd.api+json', 'application/json'], Object, oa2legged, oa2legged.getCredentials()
						));
					}
				}
				return (null);
			})
			.then((response) => {
				if ( response === null )
					return (null);
				let manifest = response.body;
				if (manifest.status !== 'success' || manifest.progress !== 'complete' || manifest.type !== 'design')
					return (null); // hum, this is a shortcut, but if we have another job running such as OBJ export, it won't work (so be careful)
				for (let i = 0; manifest.children && i < manifest.children.length; i++) {
					let child = manifest.children[i];
					if (child.role === 'viewable' && child.success === '100%' && child.progress === 'complete')
						return (true);
				}
				return (null);
			})
			.then((response) => {
				if (response === null)
					return (null);
				console.log('SVF is ready!');
			})
			.catch((error) => {
				console.error('Something went wrong while requesting the seed file manifest!', error);
			});
	}

	static async objectsMetadata (filename, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);
		let guid = options.guid || options.parent.guid || null;
		let properties = options.properties || options.parent.properties || false;
		if (properties && !guid)
			return (console.error('You must provide a guid reference!'));

		let xAdsForce = options.adsForce || options.parent.adsForce || false;
		let forceget = options.forceget || options.parent.forceget || false;
		let mdOptions = {
			xAdsForce: xAdsForce,
			forceget: forceget
		};
		let objectid = options.objectid || options.parent.objectid || null;
		if (objectid)
			mdOptions.objectid = objectid;

		let oa2legged = null;
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				let urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				let md = new ForgeAPI.DerivativesApi();
				if (properties)
					return (md.getModelviewProperties(urn, guid, mdOptions, oa2legged, oa2legged.getCredentials()));
				else if (guid)
					return (md.getModelviewMetadata(urn, guid, mdOptions, oa2legged, oa2legged.getCredentials()));
				else
					return (md.getMetadata(urn, {}, oa2legged, oa2legged.getCredentials()));
			})
			.then((manifest) => {
				console.log(JSON.stringify(manifest.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while requesting metadata for your seed file!', error);
			});
	}

	static async objectsDerivatives (filename, derivativesURN, outputFile, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);
		let info = options.info || options.parent.info || false;
		let uncompress = options.uncompress || options.parent.uncompress || false;

		let oa2legged = null;
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				let urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				let md = new ForgeAPI.DerivativesApi();
				if (info)
					return (md.getDerivativeManifestInfo(urn, derivativesURN, {}, oa2legged, oa2legged.getCredentials()));
				else
					return (md.getDerivativeManifest(urn, derivativesURN, { acceptEncoding: 'gzip' }, oa2legged, oa2legged.getCredentials()));
			})
			.then((response) => {
				if (info) {
					console.log(`Resource size: ${response.headers['content-length']} bytes`);
					return (response.headers['content-length']);
				} else
					return (utils.writeFile(outputFile, response.body, null, true));
			})
			.catch((error) => {
				console.error('Something went wrong while requesting the derivative file!', error);
			});
	}

	static async svf2ObjectIdMapping (filename, outputFile, options) {
		await utils.settings();
		filename = filename || utils.settings('objectKey', null, {});
		let bucketKey = options.bucket || options.parent.bucket || null;
		let key = options.key || options.parent.key || false;
		if (key)
			filename = Forge_MD.key2filename(filename);

		let oa2legged = null;
		let urn = '';
		Forge_MD.readBucketKey(bucketKey)
			.then((name) => {
				bucketKey = name;
				return (Forge_MD.oauth.getOauth2Legged());
			})
			.then((_oa2legged) => {
				oa2legged = _oa2legged;
				urn = Forge_MD.createOSSURN(bucketKey, filename, true);
				let apiClient = new ForgeAPI.ApiClient('https://cdn.derivative.autodesk.com');
				return (apiClient.callApi(
					'/modeldata/manifest/{urn}', 'GET',
					{ urn: urn }, {}, {}, {}, null,
					['application/json'], ['application/vnd.api+json', 'application/json'], Object, oa2legged, oa2legged.getCredentials()
				));
			})
			.then((manifest) => {
				manifest = manifest.body;
				if (manifest.status !== 'success' || manifest.progress !== 'complete' || manifest.type !== 'design')
					return (null); // hum, this is a shortcut, but if we have another job running such as OBJ export, it won't work 9so be careful)
				for (let i = 0; manifest.children && i < manifest.children.length; i++) {
					let child = manifest.children[i];
					if (child.role === 'viewable' && child.success === '100%' && child.progress === 'complete' && child.otg_manifest) {
						const otg_manifest = child.otg_manifest;
						const dbid_mapping_asset = otg_manifest.pdb_manifest.assets.filter((elt) => elt.type === 'DbIdMapping')[0];
						let root_path = otg_manifest.paths.version_root;
						let pdb_rel_path = otg_manifest.pdb_manifest.pdb_version_rel_path;
						if ( dbid_mapping_asset.isShared ) {
							root_path = otg_manifest.paths.shared_root;
							pdb_rel_path = otg_manifest.pdb_manifest.pdb_shared_rel_path;
						}

						let apiClient = new ForgeAPI.ApiClient('https://cdn.derivative.autodesk.com');
						return (apiClient.callApi(
							'/modeldata/file/{root_path}{pdb_rel_path}{uri}', 'GET',
							{ root_path: root_path, pdb_rel_path: pdb_rel_path, uri: dbid_mapping_asset.uri },
							{ acmsession: urn }, {}, {}, null,
							[], ['application/octet-stream'], null, oa2legged, oa2legged.getCredentials()
						));
					}
				}
				return (null);
			})
			.then((response) => {
				if ( response === null )
					return (null);
				return (utils.writeFile(outputFile, response.body, null, true));
			})
			.then((response) => {
				console.log(`Your SVF <-> SVF2 DB ID Mapping file was saved at: ${outputFile}`);
			})
			.catch((error) => {
				console.error('Something went wrong while requesting the dbid.idx file!', error);
			});
	}

	static async decodeSvf2ObjectIdMapping (filename, options) { // eslint-disable-line no-unused-vars
		let idx = await utils.readFile (filename);
		// if (utils.isGZip (idx))
		// 	idx = await utils.gunzip(idx, true);
		try {
			idx = await utils.gunzip(idx, true);
		} catch (ex) {
		}
		const dbidIdx = new Uint32Array(idx.buffer, idx.byteOffset, idx.byteLength / Uint32Array.BYTES_PER_ELEMENT);
		idx = [];
		for (const value of dbidIdx.values()) //   array [ svf_id ] == svf2_id  //  array.indexOf ( svf2_id ) == svf_id
			idx.push(value);
		console.log(JSON.stringify(idx, null, 4));
	}

	static readBucketKey (bucketKeyDefault) {
		return (new Promise((fulfill, reject) => {
			if (bucketKeyDefault !== undefined && bucketKeyDefault !== null && bucketKeyDefault !== '') {
				Forge_MD.checkBucketKey(bucketKeyDefault)
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
			return (encodeURIComponent(_path.basename(filename)));
		return (encodeURIComponent(filename));
	}

	static key2filename (key, pathname) {
		let filename = decodeURIComponent(key);
		if (pathname)
			return (_path.join(pathname, filename));
		return (filename);
	}

	static createOSSURN (bucketKey, filename, bEncode) {
		bEncode = bEncode || false;
		let urn = 'urn:adsk.objects:os.object:' + bucketKey + '/' + Forge_MD.filename2key(filename);
		if (bEncode)
			urn = utils.safeBase64encode(urn);
		return (urn);
	}

}

module.exports = Forge_MD;
