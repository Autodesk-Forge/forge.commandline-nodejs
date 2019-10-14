
[![Node.js](https://img.shields.io/badge/Node.js-10.16.0-blue.svg)](https://nodejs.org/)
![Platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![License](http://img.shields.io/:license-mit-blue.svg)](http://opensource.org/licenses/MIT)

*Forge API*:
[![oAuth2](https://img.shields.io/badge/oAuth2-v1-green.svg)](http://developer-autodesk.github.io/)
[![Data-Management](https://img.shields.io/badge/Data%20Management-v1-green.svg)](http://developer-autodesk.github.io/)
[![OSS](https://img.shields.io/badge/OSS-v2-green.svg)](http://developer-autodesk.github.io/)
[![Model-Derivative](https://img.shields.io/badge/Model%20Derivative-v2-green.svg)](http://developer-autodesk.github.io/)
[![Viewer](https://img.shields.io/badge/Forge%20Viewer-v7.3-green.svg)](http://developer-autodesk.github.io/)

# forge.commandline-nodejs

<b>Note:</b> For using this sample, you need a valid oAuth credential.
Visit this [page](https://forge.autodesk.com) for instructions to get on-board.


## Description

This sample exercises the Node.js engine as a command line utility to  demonstrate the Forge OAuth application authorisation process and most of the Forge Services API such as Model Derivative, Bim360, Viewer, ...

Demonstrates the use of the Autodesk Forge API using a Node.js console application. Supports both 2 legged and 3 legged protocols.

## Prerequisites

1. **Forge Account**: Learn how to create a Forge Account, activate subscription and create an app at [this tutorial](http://learnforge.autodesk.io/#/account/).
2. **Visual Studio Code**: other text editors could be used too, but Visual Studio Code is a widely used editor, see [https://code.visualstudio.com/](https://code.visualstudio.com/).
3. **Node.js**: basic knowledge of Node.js, see [https://nodejs.org/en/](https://nodejs.org/en/).
4. **JavaScript**: basic knowledge.
5. If you want to use the BIM360 API - **BIM 360 or other Autodesk storage account**: if you want to use it with files from BIM 360 Docs then you must be an Account Admin to add the app integration. [Learn about provisioning](https://forge.autodesk.com/blog/bim-360-docs-provisioning-forge-apps).

## Setup/Usage Instructions

  1. Install [NodeJS](https://nodejs.org)
  2. Download (fork, or clone) this project
  3. Install Node.js dependency modules:<br />
     ```
     npm install
     ```
  4. Request your consumer key/secret key from [https://forge.autodesk.com](https://forge.autodesk.com).
  5. Set 2 environment variables FORGE_CLIENT_ID / FORGE_CLIENT_SECRET<br />
  Mac OSX/Linux (Terminal)
     ```
     export FORGE_CLIENT_ID=<<YOUR FORGE CLIENT ID>>
     export FORGE_CLIENT_SECRET=<<YOUR FORGE CLIENT SECRET>>
     ```
     Windows (use <b>Node.js command line</b> from Start menu)
     ```
     set FORGE_CLIENT_ID=<<YOUR FORGE CLIENT ID>>
     set FORGE_CLIENT_SECRET=<<YOUR FORGE CLIENT SECRET>>
     ```

     If you only want to use Model Derivative, Data Management/OSS, Design Automation, Reality Capture - you can stop here

  6. Set an environment variable PORT (This is for running either BIM360 API or the Viewer)<br />
  Mac OSX/Linux (Terminal)
     ```
     export PORT=<<YOUR PORT NUMBER>>
     ```
     Windows (use <b>Node.js command line</b> from Start menu)
     ```
     set PORT=<<YOUR PORT NUMBER>>
     ```
  7. **Note** for the 3 legged commands: while registering your keys, make sure that the callback you define for your
     callback (or redirect_uri) match your localhost and PORT number.
     Default is : http://localhost:3006/oauth
  Mac OSX/Linux (Terminal)
     ```
     export FORGE_CALLBACK=<<YOUR FORGE CALLBACK URL>>
     ```
     Windows (use <b>Node.js command line</b> from Start menu)
     ```
     set FORGE_CALLBACK=<<YOUR FORGE CALLBACK URL>>
     ```
   8. Provision your application key on the BIM360 application integration page. [Learn about provisioning](https://forge.autodesk.com/blog/bim-360-docs-provisioning-forge-apps).

**Note**: If you do not want to set environement variables, edit the forge.js file and replace the placeholders by the values listed above.

## Usage

The utility provides help information for the commands and arguments. Use the --help option to access it.

Here are few examples (click &#9658; to expand):

<details>
   <summary>oAuth (2 legged) + DM/OSS + Model Derivative</summary>

   ```bash
   # Do authorization.
   node forge.js 2legged

   # Create a bucket. Bucket name must be lower case and valid characters.
   node forge.js buckets new my_bucket_name

   # Upload a model.
   node forge.js objects put Au.obj

   # Register the model to get it translated.
   node forge.js objects translate Au.obj

   # Wait until the translation completes.
   # Translation is complete when it reaches 'success - 100%'
   node forge.js objects progress Au.obj

   # Create an HTML page with your URN and a read-only access token.
   node forge.js html urn:adsk.objects:os.object:my_bucket_name/Au.obj ./bubbles/Au.obj.html
   ```

</details>

<details>
   <summary>oAuth (3 legged) + DM/BIM360</summary>

   ```bash
   # Do authorization/authentication.
   node forge.js 3legged auto

   # Get the list of Hubs.
   node forge.js hubs ls

   # Get the list of projects.
   node forge.js projects ls $MyHubID

   # Get the entire project data tree.
   node forge.js projects tree $MyHubID $MyProjectID -f

   # Refresh the access token
   node forge.js 3legged refresh
   ```

</details>

<br />
Note your access token, bucket name and other information are saved in the data folder to be used as default values by the utility, but you can
edit them as you wish.

# SVF and OTG bubble

Forge provides a service to extract CAD design file information into what Autodesk engineers calls a Bubble. The SVF Bubble is a collection of files (pack files for mesh, images for tecxtures, json for manifest and metadata) and is the default output "format" for the Model Derivative API, and consumed by the Viewer.

Recently, the Autodesk engineers refined the process to make a lightweight Bubble for AEC/BIM outputs, called OTG. While it was designed for AEC/BIM, OTG would still work for our scenarios but not guarantee on the reduction ratio compared to SVF. The Viewer also supports OTG natively, and would nicely switch to OTG with no code change other than the initializer configuration.

### OTG de-duplication

OTG uses a de-duplication process of meshes. So think of a wall as a cube. And many walls are just a cube that is squished and rotated into place. So imagine all walls of a building represented by a single cube with many transforms. This saves storage space (data transfer). BUT.... It also significantly improves render performance, with GPU instancing. You send a single cube mesh to the GPU and thousands of tiny transforms as a single draw-call, thus drawing signicantly more triangles per frame.

Similar to the cube primative for walls, the same thing happens for Re-Bar and hand-rails, it's mostly de-duplication of a 'cylindrical primitive'.

### OTG precision

OTG (centered at the origin) can theoretically measure a 20km stretch at 4.6 micron precision, which is just equivalent to the limit of 32 bit float precision. Currently, OTG uses a single double precision offset for each model.

Linear designs or geospatial models are yet to be validated with OTG. We are looking for feedback.

---

This utility does provide a way to download the SVF and OTG Bubbles on your local machine for debugging propose. We do recommend you to read the Viewer copyright and understands limitations in using local copies. Here is the copy of the Viewer copyright notice for your convenience.

```javascript
/*!
 * LMV v7.3.0
 * 
 * Copyright 2019 Autodesk, Inc.
 * All rights reserved.
 * 
 * This computer source code and related instructions and comments are the
 * unpublished confidential and proprietary information of Autodesk, Inc.
 * and are protected under Federal copyright and state trade secret law.
 * They may not be disclosed to, copied or used by any third party without
 * the prior written consent of Autodesk, Inc.
 * 
 * Autodesk Forge Viewer Usage Limitations:
 * 
 * The Autodesk Forge viewer can only be used to view files generated by
 * Autodesk Forge services. The Autodesk Forge Viewer JavaScript must be
 * delivered from an Autodesk hosted URL.
 */
```

(click &#9658; to expand)

<details>
   <summary>Downloading and run the SVF bubble</summary>

   ```bash
   # Do authorization/authentication.
   node forge.js 3legged auto

   # Get the list of Hubs.
   node forge.js hubs ls

   # Get the list of projects.
   node forge.js projects ls $MyHubID

   # Get the Project tree information.
   node forge.js projects tree $MyHubID $MyProjectID

   # Download the SVF Bubble
   node forge.js bubble get $MyVersionID ./bubbles/MyPath

   # Create an HTML page with your local URN
   node forge.js html /MyPath/bubble.json ./bubbles/output.html

   # Start local server and load the HTML page.
   open http://localhost:$PORT/output.html & http-server ./bubbles/
   ```

</details>

<br />
For running OTG, please read the fluent-server/README.md

(click &#9658; to expand)

<details>
   <summary>Downloading and run the OTG bubble</summary>

   ``` bash
   # Do authorization/authentication.
   node forge.js 3legged auto

   # Get the list of Hubs.
   node forge.js hubs ls

   # Get the list of projects.
   node forge.js projects ls $MyHubID

   # Get the Project tree information.
   node forge.js projects tree $MyHubID $MyProjectID

   # Download the SVF Bubble
   node forge.js bubble get $MyVersionID ./bubbles/MyPath --otg

   # Create an HTML page with your local URN
   node forge.js html /MyPath/VERSION_NUMBER/bubble.json ./bubbles/output.html

   # Start local server and load the HTML page.
   open http://localhost:7124/output.html & PORT=7124 & node fluent-server/start.js ./bubbles/
   ```

</details>

# Further reading

Documentation:

- [BIM 360 API](https://developer.autodesk.com/en/docs/bim360/v1/overview/) and [App Provisioning](https://forge.autodesk.com/blog/bim-360-docs-provisioning-forge-apps)
- [Data Management API](https://developer.autodesk.com/en/docs/data/v2/overview/)
- [Viewer](https://developer.autodesk.com/en/docs/viewer/v6)

Tutorials:

- [View BIM 360 Models](http://learnforge.autodesk.io/#/tutorials/viewhubmodels)
- [Retrieve Issues](https://developer.autodesk.com/en/docs/bim360/v1/tutorials/retrieve-issues)

Blogs:

- [Forge Blog](https://forge.autodesk.com/categories/bim-360-api)
- [Field of View](https://fieldofviewblog.wordpress.com/), a BIM focused blog

OTG:

* [Load OTG with ForgeViewer sample](https://github.com/wallabyway/OTG-client-sample)

![thumbnail](/thumbnail.png)

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT).
Please see the [LICENSE](LICENSE) file for full details.

## Written by

Cyrille Fauvel <br />
Forge Partner Development <br />
http://developer.autodesk.com/ <br />
http://around-the-corner.typepad.com <br />
