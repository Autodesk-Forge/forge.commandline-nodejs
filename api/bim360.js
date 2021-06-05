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
const { BIM360Client } = require('forge-server-utils');
const utils = require('./utils');

class Forge_BIM360 {

	static get oauth () {
		return (Forge_BIM360._oauth);
	}

	static set oauth (val) {
		Forge_BIM360._oauth = val;
	}

	// Issues

	// container (3legged)
	static async getContainer (hubId, projectId, options) {
		await utils.settings();
		hubId = hubId === '-' ? undefined : hubId;
		hubId = hubId || utils.settings('hubid', null, {});
		projectId = projectId || utils.settings('projectid', null, {});
		const json = options.json || options.parent.json || false;
		const current = options.current || options.parent.current || null;

		Forge_BIM360.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let projects = new ForgeAPI.ProjectsApi();
				return (projects.getProject(hubId, projectId, oa3Legged, oa3Legged.credentials));
			})
			.then((project) => {
				//console.log(JSON.stringify(project, null, 4));
				let issues = project.body.data.relationships.issues.data;
				if (issues.type != 'issueContainerId')
					return;
				if (json)
					console.log(JSON.stringify([issues], null, 4));
				else
					console.table([issues]);
				if ( current != null )
					utils.settings('containerid', issues.id, {});
			})
			.catch((error) => {
				console.log(error);
			});
	}

	// issues (3legged)
	static async issuesLs (containerId, options) { // eslint-disable-line no-unused-vars
		await utils.settings();
		containerId = containerId || utils.settings('containerid', null, {});
		
		Forge_BIM360.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let bim360 = new BIM360Client({ token: oa3Legged.credentials.access_token });
				return (bim360.listIssues(containerId));
			})
			.then((issues) => {
				console.log(JSON.stringify(issues, null, 4));

			})
			.catch((error) => {
				console.log(error);
			});
	}

}

module.exports = Forge_BIM360;
