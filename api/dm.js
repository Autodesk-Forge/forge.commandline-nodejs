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
const utils = require('./utils');

class Forge_DM {

	static get oauth () {
		return (Forge_DM._oauth);
	}

	static set oauth (val) {
		Forge_DM._oauth = val;
	}

	// hubs (3legged)
	static hubsLs (options) { // eslint-disable-line no-unused-vars
		let json = options.json || options.parent.json || false;
		let raw = options.raw || options.parent.raw || false;
		let current = options.current || options.parent.current || null;

		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let hubs = new ForgeAPI.HubsApi();
				return (hubs.getHubs({}, oa3Legged, oa3Legged.credentials));
			})
			.then((hubs) => {
				if (hubs.body.meta && hubs.body.meta.warnings) {
					for (let key in hubs.body.meta.warnings) {
						let warning = hubs.body.meta.warnings[key];
						console.warn(warning.HttpStatusCode + '/' + warning.ErrorCode + ': ' + warning.Detail + ' > ' + warning.Title);
					}
				}
				let hubsForTree = [];
				if (json && raw) {
					hubsForTree = hubs;
				} else {
					hubs.body.data.forEach((hub) => {
						let hubType = null;
						switch (hub.attributes.extension.type) {
							case 'hubs:autodesk.core:Hub':
								hubType = 'hubs';
								break;
							case 'hubs:autodesk.a360:PersonalHub':
								hubType = 'personalHub';
								break;
							case 'hubs:autodesk.bim360:Account':
								hubType = 'bim360Hubs';
								break;
						}
						hubsForTree.push({
							id: hub.id,
							href: hub.links.self.href,
							name: hub.attributes.name,
							type: hubType,
							state: true
						});
					});
				}
				if (json) {
					console.log(JSON.stringify(hubsForTree, null, 4));
				} else {
					const output = hubsForTree.map((elt) => {
						delete elt.href;
						return (elt);
					});
					console.table(output);
				}
				if (current !== null)
					utils.settings('hubid', hubsForTree[current].id, {});

				return (utils.writeFile(utils.data('hubs'), hubsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static async hubInfo (hubId, options) {
		await utils.settings();
		hubId = hubId || utils.settings('hubid', null, {});
		let json = options.json || options.parent.json || false;
		let raw = options.raw || options.parent.raw || false;

		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let hubs = new ForgeAPI.HubsApi();
				return (hubs.getHub(hubId, oa3Legged, oa3Legged.credentials));
			})
			.then((details) => {
				let info = {};
				if (json && raw) {
					info = details;
				} else {
					info = details.body;
				}
				if (json) {
					console.log(JSON.stringify(info, null, 4));
				} else {
					const output = {
						id: info.data.id,
						name: info.data.attributes.name,
						region: info.data.attributes.region,
						type: info.data.attributes.extension.type,
						data: info.data.attributes.extension.data,
					};
					console.log(JSON.stringify(output, null, 4));
				}

				return (utils.writeFile(utils.data('hub-' + hubId), details));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// projects
	static async projectsLs (hubId, options) {
		await utils.settings();
		hubId = hubId || utils.settings('hubid', null, {});
		let json = options.json || options.parent.json || false;
		let raw = options.raw || options.parent.raw || false;
		let current = options.current || options.parent.current || null;
		let page = options.page || options.parent.page || 0;
		let limit = options.limit || options.parent.limit || 200;

		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let projects = new ForgeAPI.ProjectsApi();
				return (projects.getHubProjects(
					hubId,
					{
						pageNumber: page,
						pageLimit: limit
					},
					oa3Legged, oa3Legged.credentials
				));
			})
			.then((projects) => {
				let projectsForTree = [];
				if (json && raw) {
					projectsForTree = projects;
				} else {
					projects.body.data.forEach((project) => {
						let projectType = 'projects';
						switch (project.attributes.extension.type) {
							case 'projects:autodesk.core:Project':
								projectType = 'a360projects';
								break;
							case 'projects:autodesk.bim360:Project':
								projectType = 'bim360projects';
								break;
						}
						projectsForTree.push({
							id: project.id,
							href: project.links.self.href,
							name: project.attributes.name,
							type: projectType,
							state: true
						});
					});
				}
				if (json) {
					console.log(JSON.stringify(projectsForTree, null, 4));
				} else {
					const output = projectsForTree.map((elt) => {
						delete elt.href;
						return (elt);
					});
					console.table(output);
				}
				if (current !== null)
					utils.settings('projectid', projectsForTree[current].id, {});

				return (utils.writeFile(utils.data('projects-' + hubId), projectsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static async projectsRoots (hubId, projectId, options) {
		await utils.settings();
		hubId = hubId === '-' ? undefined : hubId;
		hubId = hubId || utils.settings('hubid', null, {});
		projectId = projectId || utils.settings('projectid', null, {});
		let json = options.json || options.parent.json || false;
		let current = options.current || options.parent.current || null;

		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let projects = new ForgeAPI.ProjectsApi();
				return (projects.getProjectTopFolders(hubId, projectId, oa3Legged, oa3Legged.credentials));
			})
			.then((folders) => {
				let folderItemsForTree = [];
				folders.body.data.forEach((item) => {
					folderItemsForTree.push({
						id: item.id,
						href: item.links.self.href,
						name: item.attributes.displayName === null ? item.attributes.name : item.attributes.displayName,
						type: item.type,
						state: true
					});
				});
				if (json) {
					console.log(JSON.stringify(folderItemsForTree, null, 4));
				} else {
					const output = folderItemsForTree.map((elt) => {
						delete elt.href;
						return (elt);
					});
					console.table(output);
				}
				if (current !== null) {
					utils.settings('rootid', folderItemsForTree[current].id, {});
					utils.settings('folderid', folderItemsForTree[current].id, {});
				}
				return (utils.writeFile(utils.data('roots-' + projectId), folderItemsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static async projectsTree (hubId, projectId, options) {
		options = options || { parent: {} };

		await utils.settings();
		hubId = hubId === '-' ? undefined : hubId;
		hubId = hubId || utils.settings('hubid', null, {});
		projectId = projectId || utils.settings('projectid', null, {});

		const reformat = options.format || options.parent.format || false;
		console.log('Collecting data...');

		const getContentVersions = (_projectId, itemId) => {
			return (new Promise((fulfill, reject) => {
				let unsupported = Forge_DM.getUnsupported();
				let tree = [];
				Forge_DM.oauth.getOauth3Legged()
					.then((oa3Legged) => {
						let folders = new ForgeAPI.ItemsApi();
						return (folders.getItemVersions(_projectId, itemId, {}, oa3Legged, oa3Legged.credentials));
					})
					.then((versions) => {
						versions.body.data.forEach((version) => {
							let displayName = version.attributes.displayName === null ? version.attributes.name : version.attributes.displayName;
							//let lastModifiedTime =moment (version.attributes.lastModifiedTime) ;
							//let days =moment ().diff (lastModifiedTime, 'days') ;
							//let dateFormated =(versions.body.data.length > 1 || days > 7 ? lastModifiedTime.format ('MMM D, YYYY, h:mm a') : lastModifiedTime.fromNow ()) ;
							let versionst = version.id.match(/^(.*)\?version=(\d+)$/)[2];
							tree.push({
								id: version.id,
								parentId: itemId,
								href: version.links.self.href,
								//name: decodeURI ('v' + versionst + ': ' + dateFormated + ' by ' + version.attributes.lastModifiedUserName),
								name: displayName,
								filename: version.attributes.name,
								versionNumber: version.attributes.versionNumber,
								version: version.attributes.extension ? version.attributes.extension.version : versionst,
								type: (unsupported.indexOf(version.attributes.createUserName) === -1 ? 'versions' : 'unsupported'),
								lastModified: version.attributes.lastModifiedTime,
								lastModifiedUserName: version.attributes.lastModifiedUserName,
								state: false
							});
						});
						fulfill(tree);
					})
					.catch((error) => {
						reject(error);
					});
			}));
		};

		const getFolderContents = (_projectId, folderId) => {
			return (new Promise((fulfill, reject) => {
				let unsupported = Forge_DM.getUnsupported();
				let tree = {};
				Forge_DM.oauth.getOauth3Legged()
					.then((oa3Legged) => {
						let folders = new ForgeAPI.FoldersApi();
						return (folders.getFolderContents(_projectId, folderId, {}, oa3Legged, oa3Legged.credentials));
					})
					.then((folderContents) => {
						let jobs = [];
						folderContents.body.data.forEach((item) => {
							let displayName = item.attributes.displayName === null ? item.attributes.name : item.attributes.displayName;
							let itemType = (unsupported.indexOf(item.attributes.createUserName) === -1 ? item.type : 'unsupported');
							if (displayName !== '') { // BIM 360 Items with no displayName also don't have storage, so no file to transfer
								tree[item.id] = {
									id: item.id,
									parentId: folderId,
									href: item.links.self.href,
									name: displayName,
									type: itemType,
									state: (itemType !== 'unsupported')
								};
								if (item.type === 'folders') {
									jobs.push(getFolderContents(_projectId, item.id));
									//tree [item.id].folders ={} ;
								} else if (item.type === 'items') {
									//tree [item.id].filename =item.attributes.name ;
									jobs.push(getContentVersions(_projectId, item.id));
									// tree [item.id].versions =[] ;
								}
							}
						});
						return (Promise.all(jobs));
					})
					.then((results) => {
						results.forEach((item) => {
							Object.keys(item).forEach((key) => {
								if (!tree[item[key].parentId][item[key].type])
									tree[item[key].parentId][item[key].type] = {};
								tree[item[key].parentId][item[key].type][key] = item[key];
							});
						});
						fulfill(tree);
					})
					.catch((error) => {
						reject(error);
					});
			}));
		};

		try {
			const oa3Legged = await Forge_DM.oauth.getOauth3Legged();
			const projects = new ForgeAPI.ProjectsApi();
			const folders = await projects.getProjectTopFolders(hubId, projectId, oa3Legged, oa3Legged.credentials);

			const tree = {};
			let jobs = [];
			folders.body.data.forEach((item) => {
				tree[item.id] = {
					id: item.id,
					href: item.links.self.href,
					name: item.attributes.displayName === null ? item.attributes.name : item.attributes.displayName,
					type: item.type,
					state: true
				};
				if (item.type === 'folders') {
					let job = getFolderContents(projectId, item.id);
					jobs.push(job);
					tree[item.id].folders = {};
				}
			});
			const results = await Promise.all(jobs);
			results.forEach((item) => {
				Object.keys(item).forEach((key) => {
					tree[item[key].parentId].folders[key] = item[key];
				});
			});
			console.log('Result saved in: ' + utils.data('tree-' + projectId));
			return (utils.writeFile(utils.data('tree-' + projectId), reformat === true ? JSON.stringify(tree, null, 4) : tree));
		} catch (ex) {
			console.error(ex);
		}
	}

	// folders
	static async foldersLs (projectId, folderId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		folderId = folderId || utils.settings('folderid', null, {});
		let json = options.json || options.parent.json || false;
		let current = options.current || options.parent.current || null;

		let unsupported = Forge_DM.getUnsupported();
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let folders = new ForgeAPI.FoldersApi();
				return (folders.getFolderContents(projectId, folderId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((folderContents) => {
				let folderItemsForTree = [];
				folderContents.body.data.forEach((item) => {
					let displayName = item.attributes.displayName === null ? item.attributes.name : item.attributes.displayName;
					let itemType = (unsupported.indexOf(item.attributes.createUserName) === -1 ? item.type : 'unsupported');
					if (displayName !== '') { // BIM 360 Items with no displayName also don't have storage, so no file to transfer
						folderItemsForTree.push({
							id: item.id,
							href: item.links.self.href,
							name: displayName,
							type: itemType,
							state: (itemType !== 'unsupported')
						});
					}
				});
				if (json) {
					console.log(JSON.stringify(folderItemsForTree, null, 4));
				} else {
					const output = folderItemsForTree.map((elt) => {
						delete elt.href;
						return (elt);
					});
					console.table(output);
				}
				if (current !== null)
					utils.settings(folderItemsForTree[current].type === 'folders' ? 'folderid' : 'itemid', folderItemsForTree[current].id, {});

				return (utils.writeFile(utils.data('contents-' + folderId), folderItemsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// versions
	static async versionsInfo (projectId, itemId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		itemId = itemId || utils.settings('itemid', null, {});
		let json = options.json || options.parent.json || false;
		let current = options.current || options.parent.current || null;

		let unsupported = Forge_DM.getUnsupported();
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let items = new ForgeAPI.ItemsApi();
				return (items.getItemVersions(projectId, itemId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((versions) => {
				let versionsForTree = [];
				versions.body.data.forEach((version) => {
					let displayName = version.attributes.displayName === null ? version.attributes.name : version.attributes.displayName;
					//let lastModifiedTime =moment (version.attributes.lastModifiedTime) ;
					//let days =moment ().diff (lastModifiedTime, 'days') ;
					//let dateFormated =(versions.body.data.length > 1 || days > 7 ? lastModifiedTime.format ('MMM D, YYYY, h:mm a') : lastModifiedTime.fromNow ()) ;
					let versionst = version.id.match(/^(.*)\?version=(\d+)$/)[2];
					versionsForTree.push({
						id: version.id,
						href: version.links.self.href,
						//name: decodeURI ('v' + versionst + ': ' + dateFormated + ' by ' + version.attributes.lastModifiedUserName),
						name: displayName,
						filename: version.attributes.name,
						versionNumber: version.attributes.versionNumber,
						version: version.attributes.extension ? version.attributes.extension.version : versionst,
						type: (unsupported.indexOf(version.attributes.createUserName) === -1 ? 'versions' : 'unsupported'),
						lastModified: version.attributes.lastModifiedTime,
						lastModifiedUserName: version.attributes.lastModifiedUserName,
						state: false
					});
				});
				if (json) {
					console.log(JSON.stringify(versionsForTree, null, 4));
				} else {
					const output = versionsForTree.map((elt) => {
						delete elt.href;
						return (elt);
					});
					console.table(output);
				}
				if (current !== null)
					utils.settings('versionid', versionsForTree[current].id, {});
				return (utils.writeFile(utils.data('versions-' + itemId), versionsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// version
	static async versionInfo (projectId, versionId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				console.log(JSON.stringify(version.body.data, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while requesting the version status!', error);
			});
	}

	static async versionTranslate (projectId, versionId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

		let master = options.master || options.parent.master || null;
		let force = options.force || options.parent.force || false;
		let references = options.references || options.parent.references || false;
		let region = options.region || options.parent.region || 'US';
		//let compressed = (_path.extname(filename).toLowerCase() === '.zip' || _path.extname(filename).toLowerCase() === '.rar');
		let compressed = false;
		if (compressed && master === null)
			return (console.error('You must provide a master file reference!'));


		let _oa3Legged = null;
		let jobs = null;
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				_oa3Legged = oa3Legged;
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				const urn = utils.safeBase64encode(version.body.data.id);
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
				return (md.translate(_jobs, { xAdsForce: force }, _oa3Legged, _oa3Legged.credentials));
			})
			.then((response) => {
				console.log(JSON.stringify(response.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while requesting translation for your seed file!', error);
			});
	}

	static async versionStatus (projectId, versionId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

		let _oa3Legged = null;
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				_oa3Legged = oa3Legged;
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				const urn = utils.safeBase64encode(version.body.data.id);
				const derivatives = new ForgeAPI.DerivativesApi();
				return (derivatives.getManifest(urn, {}, _oa3Legged, _oa3Legged.credentials));
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
				console.error('Something went wrong while requesting the version info!', error);
			});
	}

	static async versionManifest (projectId, versionId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

		let svf = options.svf || options.parent.svf || false;

		let _oa3Legged = null;
		let urn = '';
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				_oa3Legged = oa3Legged;
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				urn = utils.safeBase64encode(version.body.data.id);
				const derivatives = new ForgeAPI.DerivativesApi();
				return (derivatives.getManifest(urn, {}, _oa3Legged, _oa3Legged.credentials));
			})
			.then((manifest) => {
				manifest = manifest.body;
				console.log(JSON.stringify(manifest, null, 4));

				for (let i = 0; manifest.derivatives && i < manifest.derivatives.length; i++) {
					let derivative = manifest.derivatives[i];
					if (derivative.outputType === 'svf2' && svf) {
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
				if (response === null)
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
				console.error('Something went wrong while requesting the manifest!', error);
			});
	}

	static async versionMetadata (projectId, versionId, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

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

		let _oa3Legged = null;
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				_oa3Legged = oa3Legged;
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				const urn = utils.safeBase64encode(version.body.data.id);
				const derivatives = new ForgeAPI.DerivativesApi();
				if (properties)
					return (derivatives.getModelviewProperties(urn, guid, mdOptions, _oa3Legged, _oa3Legged.credentials));
				else if (guid)
					return (derivatives.getModelviewMetadata(urn, guid, mdOptions, _oa3Legged, _oa3Legged.credentials));
				else
					return (derivatives.getMetadata(urn, {}, _oa3Legged, _oa3Legged.credentials));
			})
			.then((manifest) => {
				console.log(JSON.stringify(manifest.body, null, 4));
			})
			.catch((error) => {
				console.error('Something went wrong while requesting the model metadata!', error);
			});
	}

	static async versionDerivatives (projectId, versionId, derivativesURN, outputFile, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

		let info = options.info || options.parent.info || false;
		let uncompress = options.uncompress || options.parent.uncompress || false;

		let _oa3Legged = null;
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				_oa3Legged = oa3Legged;
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				const urn = utils.safeBase64encode(version.body.data.id);
				const derivatives = new ForgeAPI.DerivativesApi();
				if (info)
					return (derivatives.getDerivativeManifestInfo(urn, derivativesURN, {}, _oa3Legged, _oa3Legged.credentials));
				else
					return (derivatives.getDerivativeManifest(urn, derivativesURN, { acceptEncoding: 'gzip' }, _oa3Legged, _oa3Legged.credentials));
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

	static async svf2ObjectIdMapping (projectId, versionId, outputFile, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		versionId = versionId || utils.settings('versionid', null, {});

		let _oa3Legged = null;
		let urn = '';
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				_oa3Legged = oa3Legged;
				let versions = new ForgeAPI.VersionsApi();
				return (versions.getVersion2(projectId, versionId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((version) => {
				urn = utils.safeBase64encode(version.body.data.id);
				let apiClient = new ForgeAPI.ApiClient('https://cdn.derivative.autodesk.com');
				return (apiClient.callApi(
					'/modeldata/manifest/{urn}', 'GET',
					{ urn: urn }, {}, {}, {}, null,
					['application/json'], ['application/vnd.api+json', 'application/json'], Object, _oa3Legged, _oa3Legged.credentials
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
						if (dbid_mapping_asset.isShared) {
							root_path = otg_manifest.paths.shared_root;
							pdb_rel_path = otg_manifest.pdb_manifest.pdb_shared_rel_path;
						}

						let apiClient = new ForgeAPI.ApiClient('https://cdn.derivative.autodesk.com');
						return (apiClient.callApi(
							'/modeldata/file/{root_path}{pdb_rel_path}{uri}', 'GET',
							{ root_path: root_path, pdb_rel_path: pdb_rel_path, uri: dbid_mapping_asset.uri },
							{ acmsession: urn }, {}, {}, null,
							['application/json'], ['application/vnd.api+json', 'application/json'], null, _oa3Legged, _oa3Legged.credentials
						));
					}
				}
				return (null);
			})
			.then((response) => {
				if (response === null)
					return (null);
				return (utils.writeFile(outputFile, response.body, null, true));
			})
			.then((response) => {
				console.log(`Your SVF <-> SVF2 DB ID Mapping file was saved at: ${outputFile}`);
			})

			.catch((error) => {
				console.error('Something went wrong while requesting the model metadata!', error);
			});
	}

	static async searchAndSet (projectId, what, options) {
		await utils.settings();
		projectId = projectId === '-' ? undefined : projectId;
		projectId = projectId || utils.settings('projectid', null, {});
		const hubId = utils.settings('hubid', null, {});
		const regex = new RegExp(what);

		const json = options.json || options.parent.json || false;
		const current = options.current || options.parent.current || null;
		const tree = options.force || options.parent.force || false;

		const iterate = (parent, obj, results) => {
			Object.keys(obj).forEach((key) => {
				const node = obj[key];
				if (regex.test(node.name || node.filename))
					results.push({
						type: node.type,
						name: (node.name || node.filename),
						id: node.id,
						state: node.state,
						parent: parent,
					});
				const next = node.folders || node.items || node.versions || false;
				if (next)
					return (iterate({ node, parent }, next, results));
			});
		};

		try {
			const results = [];
			let content = null;
			if (tree || ! await utils.fileexists(utils.data('tree-' + projectId)))
				content = await Forge_DM.projectsTree(hubId, projectId);
			else
				content = await utils.json('tree-' + projectId);
			iterate({ node: { type: 'hub', id: hubId } }, content, results);

			if (current !== null) {
				utils.settings('projectid', projectId, {});
				let node = results[current];
				await utils.settings(node.type.replace(/s$/, '') + 'id', node.id, {});
				let folder = false;
				for (let parent = node.parent; parent; parent = parent.parent) {
					node = parent.node;
					if (node.type !== 'folders' || folder === false)
						//console.log(node.type.replace(/s$/, '') + 'id', node.id);
						await utils.settings(node.type.replace(/s$/, '') + 'id', node.id, {});
					folder = node.type === 'folders' ? node.id : folder;
				}
				utils.settings('rootid', folder, {});
			}

			if (json) {
				results.map((elt) => delete elt.parent);
				console.log(JSON.stringify(results, null, 4));
			} else {
				results.map((elt) => delete elt.parent);
				console.table(results);
			}
		} catch (ex) {
			console.error(ex);
		}
	}

	static getUnsupported () {
		return ([
			'bot@autodesk360.com'
		]);
	}

}

module.exports = Forge_DM;
