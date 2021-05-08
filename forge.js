#!/usr/bin/env node
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

process.setMaxListeners(100);
const program = require('commander');

const ForgeSettings = {
	clientId: process.env.FORGE_CLIENT_ID || 'your_client_id',
	clientSecret: process.env.FORGE_CLIENT_SECRET || 'your_client_secret',
	PORT: process.env.PORT || '3000',
	callback: process.env.FORGE_CALLBACK || ('http://localhost:' + (process.env.PORT || '3000') + '/oauth'),

	grantType: 'client_credentials',
	opts: { 'scope': 'data:read data:write data:create data:search bucket:create bucket:read bucket:update bucket:delete viewables:read' },
	optsViewer: { 'scope': 'viewables:read' },

	chunkSize: 5 * 1024 * 1024, // 5Mb
	//chunkSize: 2 * 1024 * 1024, // 2Mb
	minChunkSize: 2 * 1024 * 1024, // 2Mb

	viewerVersion: 'v7.34.2',
};

const ForgeOauth = require('./api/oauth'); // Oauth
ForgeOauth.settings = ForgeSettings;
const ForgeOSS = require('./api/oss'); // OSS
ForgeOSS.oauth = ForgeOauth;
ForgeOSS.chunkSize = ForgeSettings.chunkSize;
ForgeOSS.minChunkSize = ForgeSettings.minChunkSize;
const ForgeDM = require('./api/dm'); // Data Management
ForgeDM.oauth = ForgeOauth;
const ForgeMD = require('./api/md'); // Model Derivative
ForgeMD.oauth = ForgeOauth;
const ForgeOther = require('./api/other'); // Others
ForgeOther.oauth = ForgeOauth;
ForgeOther.viewerVersion = ForgeSettings.viewerVersion;
const ForgeBIM360 = require('./api/bim360'); // BIM360
ForgeBIM360.oauth = ForgeOauth;

// commander utils
function registerCommands (p, commands) {
	commands.forEach((cmd) => {
		let t = p
			.command(cmd.name)
			.description(cmd.description)
			.action(cmd.action /*|| dispatchSubCommand*/);
		if (cmd.arguments)
			t.arguments(cmd.arguments);
		if (cmd.isDefault)
			p._defaultCommand = cmd.name;
		if (cmd.options) {
			cmd.options.forEach(function (option) {
				t.option(option.option, option.description);
				//p.option(option.option, option.description);
			});
		}
	});
}

// commands definitions
let commands = [
	{
		name: 'token', action: ForgeOauth.localToken,
		description: 'get/set your access token (2legged/3legged)',
		arguments: '[token] [refresh]'
	},

	{ name: '2legged', action: ForgeOauth._2legged, description: 'get an application access token (2legged)' },
	{ name: '2legged-verify', action: ForgeOauth._2leggedVerify, description: 'verify access token (2legged)' },
	{ name: '2legged-logout', action: ForgeOauth._2leggedRelease, description: 'release the application access token (2legged)' },

	{
		name: '3legged', action: ForgeOauth._3legged,
		description: '3 legged operations (3legged) [code] could be empty / auto / refresh / or the autorization code',
		arguments: '[code]',
		options: [
			{ option: '-i, --implicit', description: 'run an implicit grant vs code grant' }
		]
	},
	{ name: '3legged-verify', action: ForgeOauth._3leggedVerify, description: 'verify access token (3legged)' },
	{ name: '3legged-logout', action: ForgeOauth._2leggedRelease, description: 'release the application access token (3legged)' },

	{
		name: 'buckets-list', action: ForgeOSS.bucketsList,
		description: 'list buckets (2legged)',
		options: [
			{ option: '-s, --startAt <startAt>', description: 'startAt: where to start in the list [string, default: none]' },
			{ option: '-l, --limit <limit>', description: 'limit: how many to return [integer, default: 10]' },
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
			{ option: '-a, --all', description: 'get them all!' },
			{ option: '-j, --json', description: 'display results as JSON vs table' },
			{ option: '-c, --current <current>', description: 'index from list to set as current bucket (i.e. buckets-current command)' },
		]
	},
	{
		name: 'buckets-current', action: ForgeOSS.bucketsCurrent,
		description: 'get/set your current bucket (2legged)',
		arguments: '[bucketKey]'
	},
	{
		name: 'buckets-new', action: ForgeOSS.bucketsNew,
		description: 'create a new bucket,; default Type is persistent, values can be transient/temporary/persistent (2legged)',
		arguments: '<bucketKey> [type]',
		options: [
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
			{ option: '-k, --key <authid>', description: 'The application key to grant access to' },
			{ option: '-a, --access <access>', description: 'Acceptable values: full or read [string, default: full]' }
		]
	},
	{
		name: 'buckets-delete', action: ForgeOSS.bucketsDelete,
		description: 'delete a given bucket; if no parameter delete the current bucket (2legged)',
		arguments: '<bucketKey>',
	},
	{
		name: 'buckets-info', action: ForgeOSS.bucketsInfo,
		description: 'check bucket validity, outputs the expiration; date/time for this bucket (2legged)',
		arguments: '[bucketKey]',
	},
	{
		name: 'buckets-ls', action: ForgeOSS.bucketsLs,
		description: 'list items in a given bucket; required to be in the API white list to use this API (2legged)',
		arguments: '[bucketKey]',
		options: [
			{ option: '-s, --startAt <startAt>', description: 'startAt: where to start in the list [string, default: none]' },
			{ option: '-l, --limit <limit>', description: 'limit: how many to return [integer, default: 10]' },
			{ option: '-b, --beginsWith <beginsWith>', description: 'beginsWith: String to filter the objectKeys.' },
			{ option: '-a, --all', description: 'get them all!' },
			{ option: '-j, --json', description: 'display results as JSON vs table' },
		]
	},

	{
		name: 'objects-info', action: ForgeOSS.objectsInfo,
		description: 'seed file information (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
		]
	},
	{
		name: 'objects-get', action: ForgeOSS.objectsGet,
		description: 'download a seed file (2legged)',
		arguments: '<filename> <outputFile>',
		options: [
			{ option: '-b, --bucket', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
		]
	},
	{
		name: 'objects-put', action: ForgeOSS.objectsPut,
		description: 'upload a seed file (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-s, --strippath', description: 'strip path from filename' },
			{ option: '-d, --signed <signed>', description: 'signed resource key (requires region, if not US)' },
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
		]
	},
	{
		name: 'objects-copy', action: ForgeOSS.objectsCopy,
		description: 'copy a seed file in the same bucket.(2legged)',
		arguments: '<filename> <target>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filenames represent the objectKeys on OSS vs the filenames' }
		]
	},
	{
		name: 'objects-delete', action: ForgeOSS.objectsDelete,
		description: 'delete a seed file (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
		]
	},
	{
		name: 'objects-sign', action: ForgeOSS.signObject,
		description: 'sign a seed file (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-a, --access <access>', description: 'access for signed resource Acceptable values: read, write, readwrite Default value: read' },
			{ option: '-e, --minutesexpiration <minutesexpiration>', description: 'expiration time in minutes; default: 60' },
			{ option: '-s, --singleuse', description: 'expires after it is used the first time if true. Default value: false' }
		]
	},
	{
		name: 'objects-unsign', action: ForgeOSS.unsignObject,
		description: 'unsign a seed file (2legged)',
		arguments: '<id>',
		options: [
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
		]
	},
	{
		name: 'objects-translate', action: ForgeMD.objectsTranslate,
		description: 'translate a seed file (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-m, --master <master>', description: 'define the master file when using a compressed seed file' },
			{ option: '-f, --force', description: 'force translation' },
			{ option: '-c, --references', description: 'force using references configuration in the translation' },
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
			{ option: '--ifcRevit', description: 'use Revit vs Navisworks to do IFC conversion' },
			{ option: '--ifcNavis', description: 'use Navisworks vs Revit to do IFC conversion' },
			{ option: '--generateMasterViews', description: 'generates master views when translating from the Revit' },
			{ option: '--svf', description: 'translate to the Forge SVF bubble format' },
			{ option: '--svf2', description: 'translate to the Forge SVF2 bubble format' },
			{ option: '--step', description: 'translate to the STEP format' },
			{ option: '--protocol <protocol>', description: '203 for configuration controlled design, 214 for core data for automotive mechanical design processes, 242 for managed model based 3D engineering. Default to 214.' },
			{ option: '--tolerance <tolerance>', description: 'possible values: between 0 and 1 [float, default: 0.001]' },
			{ option: '--stl', description: 'translate to the STL format' },
			{ option: '--ascii', description: 'translate to the ASCII STL format (otherwise default to Binary)' },
			{ option: '--colors', description: 'export colors during STL translation' },
			{ option: '--fs', description: 'export file structure during translation (default to single file)' },
			{ option: '--iges', description: 'translate to the IGES format' },
			{ option: '--surfaceType <surfaceType>', description: 'possible values: bounded, trimmed, wireframe [string, default: bounded]' },
			{ option: '--sheetType <sheetType>', description: 'export the sheet body to IGES open, shell, surface or wireframe [string, default: surface]' },
			{ option: '--solidType <solidType>', description: 'export the solid body to IGES solid, surface or wireframe [string, default: solid]' },
			{ option: '--fbx', description: 'translate to the Autodesk FBX format' },
			{ option: '--dwg', description: 'translate to the AutoCAD dwg format' },
			{ option: '--ifc', description: 'translate to the IFC format' },
			{ option: '--obj', description: 'translate to the OBJ format' },
			{ option: '--unit <unit>', description: 'possible values: meter, decimeter, centimeter, millimeter, micrometer, nanometer, yard, foot, inch, mil, microinch [string, default: none]' },
			{ option: '--guid <guid>', description: 'required for geometry extractions. The model view ID (guid). Currently only valid for 3d views [string, default: none]' },
			{ option: '--ids <ids>', description: 'list of DB IDs to export during tranlation (CSV format)' }
		]
	},
	{
		name: 'objects-references', action: ForgeMD.objectsReferences,
		description: 'create references for a composite design in Model Derivative (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-m, --master <filename>', description: 'specificy master (can appear multiple times' },
			{ option: '-c, --child <filename [, filename]>', description: 'specificy child, comma separated (can appear multiple times' },
		]
	},
	{
		name: 'objects-progress', action: ForgeMD.objectsTranslateStatus,
		description: 'translate progress/status of a seed file (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
		]
	},
	{
		name: 'objects-status', action: ForgeMD.objectsTranslateStatus,
		description: 'translate progress/status of a seed file (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
		]
	},
	{
		name: 'objects-manifest', action: ForgeMD.objectsManifest,
		description: 'information about derivatives that correspond to a specific seed file, including derivative URNs and statuses (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-d, --delete', description: 'delete option' }
		]
	},
	{
		name: 'objects-metadata', action: ForgeMD.objectsMetadata,
		description: 'list of model view (metadata) IDs for a design model (2legged)',
		arguments: '<filename>',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-g, --guid <guid>', description: 'returns an object tree, i.e., a hierarchical list of objects for a model view' },
			{ option: '-p, --properties', description: 'returns a list of properties for each object in an object tree. Properties are returned according to object ID and do not follow a hierarchical structure' },
			{ option: '-x, --adsForce', description: 'force retrieve the object tree even though it failed to be extracted (got 404 with error message) previously' },
			{ option: '-f, --forceget', description: 'to force get the large resource even if it exceeded the expected maximum length (20 MB)' },
			{ option: '-i, --objectid <id>', description: 'object id which you want to query properties for' },
		]
	},

	// {
	// 	name: 'objects-properties', action: ForgeMD.objectsMetadata,
	// 	description: 'returns a list of properties for each object in an object tree. Properties are returned according to object ID and do not follow a hierarchical structure (2legged)',
	// 	arguments: '<filename>',
	// 	options: [
	// 		{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
	// 		{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
	// 		{ option: '-g, --guid <guid>', description: 'returns an object tree, i.e., a hierarchical list of objects for a model view' },
	// 		{ option: '-p, --properties', description: 'returns a list of properties for each object in an object tree. Properties are returned according to object ID and do not follow a hierarchical structure' },
	// 	]
	// },

	{
		name: 'objects-derivatives', action: ForgeMD.objectsDerivatives,
		description: 'downloads the derivative specified by the derivativeurn URI parameter, which was generated from the source model specified by the urn URI parameter. To download the file, you need to specify the file’s URN, which you retrieve by calling the GET :urn/manifest endpoint.(2legged)',
		arguments: '<filename> <derivativesURN> <outputFile',
		options: [
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
			{ option: '-i, --info', description: 'information about the specified derivative, no download' },
			{ option: '-u, --uncompress', description: 'dezip response after downloads' },
		]
	},

	{
		name: 'objects-sha1', action: ForgeOSS.sha1, 
		description: 'calc file SHA1',
		arguments: '<filename>'
	},

	{ name: 'user', action: ForgeOther.userAboutMe, description: 'get the profile information of an authorizing end user (3legged)', },

	{ name: 'hubs', action: ForgeDM.hubsLs, description: 'get list of hubs (3legged)', },
	{ name: 'hubs-ls', action: ForgeDM.hubsLs, description: 'get list of hubs (3legged)', },

	{
		name: 'projects', action: ForgeDM.projectsLs,
		description: 'get list of projects (3legged)',
		arguments: '<hubId>'
	},
	{
		name: 'projects-ls', action: ForgeDM.projectsLs,
		description: 'get list of projects (3legged)',
		arguments: '<hubId>'
	},
	{
		name: 'projects-roots', action: ForgeDM.projectsRoots,
		description: 'get list of project root folders (3legged)',
		arguments: '<hubId> <projectId>'
	},
	{
		name: 'projects-tree', action: ForgeDM.projectsTree,
		description: 'get the hub/project content tree, can take a while (3legged)',
		arguments: '<hubId> <projectId>',
		options: [
			{ option: '-f, --format', description: 'reformat output' }
		]
	},

	{
		name: 'folders', action: ForgeDM.foldersLs,
		description: 'get list of folder content (3legged)',
		arguments: '<projectId> <folderId>',
	},
	{
		name: 'folders-ls', action: ForgeDM.foldersLs,
		description: 'get list of folder content (3legged)',
		arguments: '<projectId> <folderId>',
	},

	{
		name: 'versions', action: ForgeDM.versionsInfo,
		description: 'get list of item versions (3legged)',
		arguments: '<projectId> <itemId>',
	},
	{
		name: 'version-ls', action: ForgeDM.versionsInfo,
		description: 'get list of item versions (3legged)',
		arguments: '<projectId> <itemId>',
	}, {
		name: 'versions-info', action: ForgeDM.versionsInfo,
		description: 'get list of item versions (3legged)',
		arguments: '<projectId> <itemId>',
	},

	{
		name: 'bubble', action: ForgeOther.bubble,
		description: 'download the bubble (2legged/3legged)',
		arguments: '<urn> <outputFolder>',
		options: [
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
			{ option: '-o, --otg', description: 'Download OTG bubble vs SVF Bubble' },
			{ option: '-2, --svf2', description: 'Download SVF2 bubble vs SVF/OTG Bubble' },
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'urn represents the objectKey on OSS vs the urn' },
		]
	},

	{
		name: 'html', action: ForgeOther.htmlGet,
		description: 'generate HTML/viewables (2legged/3legged)',
		arguments: '<urn> <outputFilename>',
		options: [
			{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
			{ option: '-o, --otg', description: 'Use OTG vs SVF' },
			{ option: '-2, --svf2', description: 'Use SVF2 vs SVF/OTG' },
			{ option: '-l, --local', description: 'Use a local Viewer copy vs Server served Viewer' },
			{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
			{ option: '-k, --key', description: 'urn represents the objectKey on OSS vs the urn' },
		]
	},

	{
		name: 'viewer', action: ForgeOther.viewerGet,
		description: 'Download a local copy of the Forge Viewer',
		arguments: '<outputFolder>',
	},

	{
		name: 'get-container', action: ForgeBIM360.getContainer,
		description: 'Get BIM360 container',
		arguments: '<hubId> <projectId>',
	},
	{
		name: 'issues-ls', action: ForgeBIM360.issuesLs,
		description: 'Get BIM360 issues',
		arguments: '<containerId>',
	}

];

registerCommands(program, commands);
program
	.version('4.0.2')
	//.option ('-u, --usage', 'Usage')
	//.on ('--help', usage)
	.parse(process.argv);
