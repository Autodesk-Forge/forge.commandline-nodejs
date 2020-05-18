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

const program = require('commander');

const ForgeSettings = {
	clientId: process.env.FORGE_CLIENT_ID || 'your_client_id',
	clientSecret: process.env.FORGE_CLIENT_SECRET || 'your_client_secret',
	PORT: process.env.PORT || '3006',
	callback: process.env.FORGE_CALLBACK || ('http://localhost:' + (process.env.PORT || '3006') + '/oauth'),

	grantType: 'client_credentials',
	opts: { 'scope': 'data:read data:write data:create data:search bucket:create bucket:read bucket:update bucket:delete viewables:read' },
	optsViewer: { 'scope': 'viewables:read' },

	chunkSize: 5 * 1024 * 1024, // 5Mb
	//chunkSize: 2 * 1024 * 1024, // 2Mb
	minChunkSize: 2 * 1024 * 1024, // 2Mb

	viewerVersion: 'v7.3',
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
ForgeOther.viewerVersion =ForgeSettings.viewerVersion;

// commander utils
function dispatchSubCommand (sub, options) { // eslint-disable-line no-unused-vars
	this.rawArgs = this.parent.rawArgs;
	let parsed = this.parseOptions(this.normalize(this.rawArgs.slice(3)));
	let args = this.args = parsed.args;
	if (args.length === 0 && this._defaultCommand !== undefined)
		args = this.args = [this._defaultCommand];
	/*let result =*/ this.parseArgs(this.args, parsed.unknown);
}

function registerCommands (p, commands) {
	commands.forEach((cmd) => {
		let t = p
			.command(cmd.name)
			.description(cmd.description)
			.action(cmd.action || dispatchSubCommand);
		if (cmd.arguments)
			t.arguments(cmd.arguments);
		if (cmd.isDefault)
			p._defaultCommand = cmd.name;
		if (cmd.options) {
			cmd.options.forEach(function (option) {
				t.option(option.option, option.description);
				p.option(option.option, option.description);
			});
		}
		if (cmd.subcommands)
			registerCommands(t, cmd.subcommands);
	});
}

// commands definitions
let commands = [
	{
		name: 'token', description: 'get/set your access token (2legged/3legged)',
		arguments: '[token] [refresh]', action: ForgeOauth.localToken
	},

	{
		name: '2legged', description: '2 legged operations',
		subcommands: [
			{ name: 'get', isDefault: true, description: 'get an application access token (2legged)', action: ForgeOauth._2legged },
			{ name: 'logout', description: 'release the application access token (2legged)', action: ForgeOauth._2leggedRelease }
		]
	},

	{
		name: '3legged', description: '3 legged operations (3legged) [code] could be empty / auto / refresh / or the autorization code',
		arguments: '[code]', action: ForgeOauth._3legged,
		options: [
			{ option: '-i, --implicit', description: 'run an implicit grant vs code grant' }
		]
	},

	{
		name: 'buckets', description: 'bucket operations (2legged)',
		subcommands: [
			{
				name: 'list', isDefault: true, description: 'list buckets (2legged)', action: ForgeOSS.bucketsList,
				options: [
					{ option: '-s, --startAt <startAt>', description: 'startAt: where to start in the list [string, default: none]' },
					{ option: '-l, --limit <limit>', description: 'limit: how many to return [integer, default: 10]' },
					{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' }
				]
			},
			{
				name: 'current', description: 'get/set your current bucket (2legged)',
				arguments: '[bucketKey]', action: ForgeOSS.bucketsCurrent
			},
			{
				name: 'new', description: 'create a new bucket,; default Type is persistent, values can be transient/temporary/persistent (2legged)',
				arguments: '<bucketKey> [type]', action: ForgeOSS.bucketsNew,
				options: [
					{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
					{ option: '-k, --key <authid>', description: 'The application key to grant access to' },
					{ option: '-a, --access <access>', description: 'Acceptable values: full or read [string, default: full]' }
				]
			},
			{
				name: 'delete', description: 'delete a given bucket; if no parameter delete the current bucket (2legged)',
				arguments: '<bucketKey>', action: ForgeOSS.bucketsDelete
			},
			{
				name: 'info', description: 'check bucket validity, outputs the expiration; date/time for this bucket (2legged)',
				arguments: '[bucketKey]', action: ForgeOSS.bucketsInfo
			},
			{
				name: 'ls', description: 'list items in a given bucket; required to be in the API white list to use this API (2legged)',
				arguments: '[bucketKey]', action: ForgeOSS.bucketsLs,
				options: [
					{ option: '-s, --startAt <startAt>', description: 'startAt: where to start in the list [string, default: none]' },
					{ option: '-l, --limit <limit>', description: 'limit: how many to return [integer, default: 10]' },
					{ option: '-b, --beginsWith <beginsWith>', description: 'beginsWith: String to filter the objectKeys.' }
				]
			}

		]
	},

	{
		name: 'objects', description: 'object operations (2legged)',
		subcommands: [
			{
				name: 'info', description: 'seed file information (2legged)',
				arguments: '<filename>', action: ForgeOSS.objectsInfo,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
				]
			},
			{
				name: 'get', description: 'download a seed file (2legged)',
				arguments: '<filename> <outputFile>', action: ForgeOSS.objectsGet,
				options: [
					{ option: '-b, --bucket', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
				]
			},
			{
				name: 'put', description: 'upload a seed file (2legged)',
				arguments: '<filename>', action: ForgeOSS.objectsPut,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
					{ option: '-s, --strippath', description: 'strip path from filename' }
				]
			},
			{
				name: 'copy', description: 'copy a seed file in the same bucket.(2legged)',
				arguments: '<filename> <target>', action: ForgeOSS.objectsCopy,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filenames represent the objectKeys on OSS vs the filenames' }
				]
			},
			{
				name: 'delete', description: 'delete a seed file (2legged)',
				arguments: '<filename>', action: ForgeOSS.objectsDelete,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
				]
			},
			{
				name: 'sign', description: 'sign a seed file (2legged)',
				arguments: '<filename>', action: ForgeOSS.signObject,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
					{ option: '-a, --access', description: 'access for signed resource Acceptable values: read, write, readwrite Default value: read' },
					{ option: '-e, --minutesexpiration <minutesexpiration>', description: 'expiration time in minutes; default: 60' },
					{ option: '-s, --singleuse', description: 'expires after it is used the first time if true. Default value: false' }
				]
			},
			{
				name: 'unsign', description: 'unsign a seed file (2legged)',
				arguments: '<id>', action: ForgeOSS.signObject,
				options: [
					{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
				]
			},
			{
				name: 'translate', description: 'translate a seed file (2legged)',
				arguments: '<filename>', action: ForgeMD.objectsTranslate,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
					{ option: '-m, --master <master>', description: 'define the master file when using a compressed seed file' },
					{ option: '-f, --force', description: 'force translation' },
					{ option: '-c, --references', description: 'force using references configuration in the translation' },
					{ option: '-r, --region <region>', description: 'region: US or EMEA [string, default: US]' },
					{ option: '--switchLoader', description: 'switches the IFC loader from Navisworks to Revit' },
					{ option: '--generateMasterViews', description: 'generates master views when translating from the Revit' },
					{ option: '--svf', description: 'translate to the Forge bubble format' },
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
				name: 'references', description: 'create references for a composite design in Model Derivative (2legged)',
				arguments: '<filename>', action: ForgeMD.objectsReferences,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
					{ option: '-m, --master <filename>', description: 'specificy master (can appear multiple times' },
					{ option: '-c, --child <filename [, filename]>', description: 'specificy child, comma separated (can appear multiple times' },
				]
			},
			{
				name: 'progress', description: 'translate progress of a seed file (2legged)',
				arguments: '<filename>', action: ForgeMD.objectsTranslateProgress,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' }
				]
			},
			{
				name: 'manifest', description: 'information about derivatives that correspond to a specific seed file, including derivative URNs and statuses (2legged)',
				arguments: '<filename>', action: ForgeMD.objectsManifest,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
					{ option: '-d, --delete', description: 'delete option' }
				]
			},
			{
				name: 'metadata', description: 'list of model view (metadata) IDs for a design model (2legged)',
				arguments: '<filename>', action: ForgeMD.objectsMetadata,
				options: [
					{ option: '-b, --bucket <bucket>', description: 'override bucket name to be used in this session' },
					{ option: '-k, --key', description: 'filename represents the objectKey on OSS vs the filename' },
					{ option: '-g, --guid <guid>', description: 'returns an object tree, i.e., a hierarchical list of objects for a model view' },
					{ option: '-p, --properties', description: 'returns a list of properties for each object in an object tree. Properties are returned according to object ID and do not follow a hierarchical structure' },
				]
			}

		]

	},

	{
		name: 'user', isDefault: true, description: 'get the profile information of an authorizing end user (3legged)',
		action: ForgeOther.userAboutMe
	},

	{
		name: 'hubs', description: 'hubs operations (3legged)',
		subcommands: [
			{ name: 'ls', isDefault: true, description: 'get list of hubs (3legged)', action: ForgeDM.hubsLs }
		]
	},

	{
		name: 'projects', description: 'projects operations (3legged)',
		subcommands: [
			{
				name: 'ls', isDefault: true, description: 'get list of projects (3legged)',
				arguments: '<hubId>', action: ForgeDM.projectsLs
			},
			{
				name: 'roots', description: 'get list of project root folders (3legged)',
				arguments: '<hubId> <projectId>', action: ForgeDM.projectsRoots
			},
			{
				name: 'tree', description: 'get the hub/project content tree, can take a while (3legged)',
				arguments: '<hubId> <projectId>', action: ForgeDM.projectsTree,
				options: [
					{ option: '-f, --format', description: 'reformat output' }
				]
			}
		]
	},

	{
		name: 'folders', description: 'folders operations (3legged)',
		subcommands: [
			{
				name: 'ls', isDefault: true, description: 'get list of folder content (3legged)',
				arguments: '<projectId> <folderId>', action: ForgeDM.foldersLs
			},
		]
	},

	{
		name: 'versions', description: 'versions operations (3legged)',
		subcommands: [
			{
				name: 'info', isDefault: true, description: 'get list of item versions (3legged)',
				arguments: '<projectId> <itemId>', action: ForgeDM.versionsInfo
			},
		]
	},

	{
		name: 'bubble', description: 'download the bubble (2legged/3legged)',
		subcommands: [
			{
				name: 'get', isDefault: true, description: 'download the bubble (2legged/3legged)',
				arguments: '<urn> <outputFolder>', action: ForgeOther.bubble,
				options: [
					{ option: '-o, --otg', description: 'Download OTG bubble vs SVF Bubble' },
				]
			},
		]
	},

	{
		name: 'html', description: 'generate HTML/viewables (2legged/3legged)',
		subcommands: [
			{
				name: 'get', isDefault: true, description: 'generate HTML/viewables (2legged/3legged)',
				arguments: '<urn> <outputFilename>', action: ForgeOther.htmlGet,
				options: [
					{ option: '-o, --otg', description: 'Use OTG vs SVF' },
					{ option: '-l, --local', description: 'Use a local Viewer copy vs Server served Viewer' },
				]
			},
		]
	},

	{
		name: 'viewer', description: 'Download a local copy of the Forge Viewer',
		subcommands: [
			{
				name: 'get', isDefault: true, description: 'Download a local copy of the Forge Viewer',
				arguments: '<outputFolder>', action: ForgeOther.viewerGet
			},
		]
	}

];

registerCommands(program, commands);
program
	.version('3.0.0')
	//.option ('-u, --usage', 'Usage')
	//.on ('--help', usage)
	.parse(process.argv);
