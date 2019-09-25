
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

Demonstrates the Autodesk Forge API authorisation and translation process using a Node.js console application.

* both 2 legged and 3 legged

## Description

This sample exercises the Node.js engine as a command line utility to  demonstrate the Forge OAuth application
authorisation process and the Model Derivative API mentioned in the Quick Start guide.

In order to make use of this sample, you need to register your consumer key, of course:
* https://forge.autodesk.com > My Apps

This provides the credentials to supply while calling the Forge WEB service API endpoints.

## Setup/Usage Instructions

  1. Install Node.js on your computer.
  2. Download (fork, or clone) this project.
  3. Install Node.js dependency modules:<br />
     ```
     npm install
     ```
  4. Request your consumer key/secret key from [https://forge.autodesk.com](https://forge.autodesk.com).
  5. Set 2 environment variables FORGE_CLIENT_ID / FORGE_CLIENT_SECRET, or edit the forge.js 
     file and replace the placeholders by the consumer key/secret keys.
  6. *Note* for the 3 legged command: while registering your keys, make sure that the callback you define for your
     callback (or redirect_uri) match the one in the scripts (mycallback variable in forge.js).
     Default is : http://localhost:3006/oauth
  
The utility provides help information for the commands and arguments. Use the --help to see it.

A typical workflow is:

    # Do authentication.
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
    node forge.js html urn:adsk.objects:os.object:my_bucket_name/Au.obj Au.obj.html

Note your access token and bucket name are saved in the data folder to be used as default by the scripts, but you can
edit them as you wish.

Bucket information (JSON replies) returned by the system are stored in the data folder as well.

![thumbnail](/thumbnail.png)

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT).
Please see the [LICENSE](LICENSE) file for full details.


## Written by

Cyrille Fauvel <br />
Forge Partner Development <br />
http://developer.autodesk.com/ <br />
http://around-the-corner.typepad.com <br />
