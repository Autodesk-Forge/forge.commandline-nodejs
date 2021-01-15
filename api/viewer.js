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
/* eslint-disable indent */

// config.BaseEndPoint
let viewer =[
	'style.css',
	'viewer3D.js',
	'lmvworker.js',
] ;
viewer.map (function (elt) { if ( elt.endsWith('.js') ) viewer.push (elt + '.map'); }) ;

// eslint-disable-next-line no-unused-vars
let viewer_min =[
	'style.min.css',
	'viewer3D.min.js',
	'lmvworker.min.js',
] ;
viewer_min.map (function (elt) { if ( elt.endsWith('.js') ) viewer_min.push (elt + '.map'); }) ;

// extensions
let extensions =[
	// From viewer3d #57374
	'extensions/FirstPerson/FirstPerson.js',

	/* Autodesk.Viewing.Wireframes */		'extensions/Wireframes/Wireframes.js',
	/* Autodesk.RaaS*/ 						//'extensions/RaaS/RaaS.js',
	/* Autodesk.Viewing.MarkupsCore */		//'extensions/Markups/Markups.js',
	/* Autodesk.Viewing.MarkupsGui */		//'extensions/Markups/MarkupsGui.js',
											//'extensions/Markups/MarkupsGui.css',
	/* Autodesk.Billboard */				//'extensions/Billboard/Billboard.js',
	/* Autodesk.BillboardGui */				//'extensions/Billboard/Billboard.js',
	/* Autodesk.Viewing.Comments */			//'extensions/Comments/Comments.js',
	/* Autodesk.InViewerSearch */			//'extensions/InViewerSearch/InViewerSearch.js',
											//'extensions/InViewerSearch/InViewerSearch.css',
	/* Autodesk.Viewing.WebVR */			//'extensions/WebVR/WebVR.js',
											//'extensions/WebVR/WebVR.css',
	/* Autodesk.Viewing.MemoryManager */	//'extensions/MemoryManager/MemoryManager.js',
											//'extensions/MemoryManager/MemoryManagerUI.css',
	/* Autodesk.Beeline */					'extensions/Beeline/Beeline.js', // no min
	/* Autodesk.FirstPerson */				'extensions/FirstPerson/FirstPerson.js',
	/* Autodesk.BimWalk */					'extensions/BimWalk/BimWalk.js',
	/* Autodesk.Debug */					//'extensions/Debug/Debug.js',
											//'extensions/Debug/Debug.css',
	/* Autodesk.InitialVisibility */		//'extensions/InitialVisibility/InitialVisibility.js',
											'extensions/ViewCubeUi/ViewCubeUi.js',
											'extensions/Measure/Measure.js',
											'extensions/LayerManager/LayerManager.js',
											'extensions/Section/Section.js',
											'extensions/CompGeom/CompGeom.js',
											'extensions/Snapping/Snapping.js',

	// These are already included in viewer3D
	// Autodesk.Viewing.Extensions.CAM360
	// Autodesk.Viewing.Extensions.Fusion360
	// Autodesk.Viewing.Extensions.Fusion360Sim
	// Autodesk.Viewing.Extensions.FusionOrbit
	// Autodesk.Viewing.Extensions.Collaboration
	// Autodesk.Viewing.Extensions.DefaultTools
	// Autodesk.Viewing.Extensions.GamepadModule
	// Autodesk.Viewing.Extensions.Hyperlink
	// Autodesk.Viewing.Extensions.Measure
	// Autodesk.Viewing.Extensions.Section
	// Autodesk.Viewing.Extensions.ZoomWindow

	/* Autodesk.MixpanelProvider */
											'extensions/MixpanelProvider/MixpanelProvider.js',

] ;
extensions.map (function (elt) { if ( elt.endsWith('.js') ) extensions.push (elt + '.map'); }) ;

// eslint-disable-next-line no-unused-vars
let extensions_min =[
	// From viewer3d #57374
	'extensions/FirstPerson/FirstPerson.min.js',

	/* Autodesk.Viewing.Wireframes */		'extensions/Wireframes/Wireframes.min.js',
	/* Autodesk.RaaS*/ 						//'extensions/RaaS/RaaS.min.js',
	/* Autodesk.Viewing.MarkupsCore */		//'extensions/Markups/Markups.min.js',
	/* Autodesk.Viewing.MarkupsGui */		//'extensions/Markups/MarkupsGui.min.js',
											//'extensions/Markups/MarkupsGui.css',
	/* Autodesk.Billboard */				//'extensions/Billboard/Billboard.min.js',
	/* Autodesk.BillboardGui */				//'extensions/Billboard/Billboard.min.js',
	/* Autodesk.Viewing.Comments */			//'extensions/Comments/Comments.min.js',
	/* Autodesk.InViewerSearch */			//'extensions/InViewerSearch/InViewerSearch.min.js',
											//'extensions/InViewerSearch/InViewerSearch.min.css',
	/* Autodesk.Viewing.WebVR */			//'extensions/WebVR/WebVR.min.js',
											//'extensions/WebVR/WebVR.min.css',
	/* Autodesk.Viewing.MemoryManager */	//'extensions/MemoryManager/MemoryManager.min.js',
											//'extensions/MemoryManager/MemoryManagerUI.min.css',
	/* Autodesk.Beeline */					'extensions/Beeline/Beeline.js', // no min
	/* Autodesk.FirstPerson */				'extensions/FirstPerson/FirstPerson.min.js',
	/* Autodesk.BimWalk */					'extensions/BimWalk/BimWalk.min.js',
	/* Autodesk.Debug */					//'extensions/Debug/Debug.min.js',
											//'extensions/Debug/Debug.min.css',
	/* Autodesk.InitialVisibility */		//'extensions/InitialVisibility/InitialVisibility.min.js',
											'extensions/ViewCubeUi/ViewCubeUi.min.js',
											'extensions/Measure/Measure.min.js',
											'extensions/LayerManager/LayerManager.min.js',
											'extensions/Section/Section.min.js',
											'extensions/CompGeom/CompGeom.min.js',
											'extensions/Snapping/Snapping.min.js',

	// These are already included in viewer3D
	// Autodesk.Viewing.Extensions.CAM360
	// Autodesk.Viewing.Extensions.Fusion360
	// Autodesk.Viewing.Extensions.Fusion360Sim
	// Autodesk.Viewing.Extensions.FusionOrbit
	// Autodesk.Viewing.Extensions.Collaboration
	// Autodesk.Viewing.Extensions.DefaultTools
	// Autodesk.Viewing.Extensions.GamepadModule
	// Autodesk.Viewing.Extensions.Hyperlink
	// Autodesk.Viewing.Extensions.Measure
	// Autodesk.Viewing.Extensions.Section
	// Autodesk.Viewing.Extensions.ZoomWindow

	/* Autodesk.MixpanelProvider */
											'extensions/MixpanelProvider/MixpanelProvider.js',

] ;
extensions_min.map (function (elt) { if ( elt.endsWith('.js') ) extensions_min.push (elt + '.map'); }) ;

// res/environments/
let environments =[
	'CoolLight_irr.logluv.dds',
	'CoolLight_mipdrop.logluv.dds',
	'DarkSky_irr.logluv.dds',
	'DarkSky_mipdrop.logluv.dds',
	'GreyRoom_irr.logluv.dds',
	'GreyRoom_mipdrop.logluv.dds',
	'GridLight_irr.logluv.dds',
	'GridLight_mipdrop.logluv.dds',
	'IDViz_irr.logluv.dds',
	'IDViz_mipdrop.logluv.dds',
	'InfinityPool_irr.logluv.dds',
	'InfinityPool_mipdrop.logluv.dds',
	'PhotoBooth_irr.logluv.dds',
	'PhotoBooth_mipdrop.logluv.dds',
	'Plaza_irr.logluv.dds',
	'Plaza_mipdrop.logluv.dds',
	'Reflection_irr.logluv.dds',
	'Reflection_mipdrop.logluv.dds',
	'RimHighlights_irr.logluv.dds',
	'RimHighlights_mipdrop.logluv.dds',
	'SharpHighlights_irr.logluv.dds',
	'SharpHighlights_mipdrop.logluv.dds',
	'SnowField_irr.logluv.dds',
	'SnowField_mipdrop.logluv.dds',
	'SoftLight_irr.logluv.dds',
	'SoftLight_mipdrop.logluv.dds',
	'TranquilityBlue_irr.logluv.dds',
	'TranquilityBlue_mipdrop.logluv.dds',
	'WarmLight_irr.logluv.dds',
	'WarmLight_mipdrop.logluv.dds',
	'boardwalk_irr.logluv.dds',
	'boardwalk_mipdrop.logluv.dds',
	'crossroads_irr.logluv.dds',
	'crossroads_mipdrop.logluv.dds',
	'field_irr.logluv.dds',
	'field_mipdrop.logluv.dds',
	'glacier_irr.logluv.dds',
	'glacier_mipdrop.logluv.dds',
	'riverbank_irr.logluv.dds',
	'riverbank_mipdrop.logluv.dds',
	'seaport_irr.logluv.dds',
	'seaport_mipdrop.logluv.dds'
] ;
environments =environments.map (function (elt) { return ('res/environments/' + elt) ; }) ;

// res/textures/
let textures =[
	'VCarrows.png',
	'VCarrowsS0.png',
	'VCarrowsS1.png',
	'VCcontext.png',
	'VCcontextS.png',
	'VCedge1.png',
	'VChome.png',
	'VChomeS.png',
	'VCcompass-pointer-b.png',
	'VCcompass-base.png',
	'cardinalPoint.png',
	'centerMarker_X.png',
	'radial-fade-grid.png'
] ;
textures =textures.map (function (elt) { return ('res/textures/' + elt) ; }) ;

// res/ui
let ui = [ 'forge-logo.png', ];
ui = ui.map(function (elt) { return ('/res/ui/' + elt); });

// res/locales
let locales =[ 'cs', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'tr', 'zh-HANS', 'zh-HANT' ] ;
// res/locales/[locales]/
let localesJson =[
	'allstrings.json',
	//'VCcross.dds',
	//'VCcross.png',
	'VCcrossRGBA8small.dds'
] ;

locales =locales.reduce (
	(prev, elt, index, arr) => { // eslint-disable-line no-unused-vars
		return (prev.concat (
			localesJson.map ((elt2) => {
				return ('res/locales/' + elt + '/' + elt2) ;
			})
		)) ;
	},
	[]
) ;

//-
module.exports =viewer
	.concat (extensions)
	.concat (environments)
	.concat (textures)
	.concat (ui)
	.concat (locales) ;
