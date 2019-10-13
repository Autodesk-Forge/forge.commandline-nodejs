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
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let hubs = new ForgeAPI.HubsApi();
				return (hubs.getHubs({}, oa3Legged, oa3Legged.credentials));
			})
			.then((hubs) => {
				if (hubs.body.meta.warnings) {
					for (let key in hubs.body.meta.warnings) {
						let warning = hubs.body.meta.warnings[key];
						console.warn(warning.HttpStatusCode + '/' + warning.ErrorCode + ': ' + warning.Detail + ' > ' + warning.Title);
					}
				}
				let hubsForTree = [];
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
				console.log(JSON.stringify(hubsForTree, null, 4));
				return (utils.writeFile(utils.data('hubs'), hubsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// projects
	static projectsLs (hubId, options) { // eslint-disable-line no-unused-vars
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let projects = new ForgeAPI.ProjectsApi();
				return (projects.getHubProjects(hubId, {}, oa3Legged, oa3Legged.credentials));
			})
			.then((projects) => {
				let projectsForTree = [];
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
				console.log(JSON.stringify(projectsForTree, null, 4));
				return (utils.writeFile(utils.data('projects-' + hubId), projectsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static projectsRoots (hubId, projectId, options) { // eslint-disable-line no-unused-vars
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
				console.log(JSON.stringify(folderItemsForTree, null, 4));
				return (utils.writeFile(utils.data('roots-' + projectId), folderItemsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static projectsTree (hubId, projectId, options) {
		let reformat = options.format || options.parent.format || false;
		console.log('Collecting data...');

		let getContentVersions = (_projectId, itemId) => {
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

		let getFolderContents = (_projectId, folderId) => {
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

		let tree = {};
		Forge_DM.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let projects = new ForgeAPI.ProjectsApi();
				return (projects.getProjectTopFolders(hubId, projectId, oa3Legged, oa3Legged.credentials));
			})
			.then((folders) => {
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
				return (Promise.all(jobs));
			})
			.then((results) => {
				results.forEach((item) => {
					Object.keys(item).forEach((key) => {
						tree[item[key].parentId].folders[key] = item[key];
					});
				});
				console.log('Result saved in: ' + utils.data('tree-' + projectId));
				return (utils.writeFile(utils.data('tree-' + projectId), reformat === true ? JSON.stringify(tree, null, 4) : tree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// folders
	static foldersLs (projectId, folderId, options) { // eslint-disable-line no-unused-vars
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
				console.log(JSON.stringify(folderItemsForTree, null, 4));
				return (utils.writeFile(utils.data('contents-' + folderId), folderItemsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// versions
	static versionsInfo (projectId, itemId, options) { // eslint-disable-line no-unused-vars
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
				console.log(JSON.stringify(versionsForTree, null, 4));
				return (utils.writeFile(utils.data('versions-' + itemId), versionsForTree));
			})
			.catch((error) => {
				console.log(error);
			});
	}

	static getUnsupported () {
		return ([
			'bot@autodesk360.com'
		]);
	}
}

module.exports = Forge_DM;
