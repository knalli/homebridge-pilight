# Contributing Guide

Contributing to this repo is fairly easy. This document shows you how to
get the project, run all provided tests and generate a production ready build.

It also covers provided grunt tasks, that help you developing on this repo.

## Dependencies

To make sure, that the following instructions work, please install the following dependencies
on you machine:

- Node.js (at least v4 because of ES6+/ES2015+)
- npm
- Git

If you install node through the binary installation file, **npm** will be already there.

## Installation

To get the source of this project clone the git repository via:

````
$ git clone https://github.com/knalli/homebrige-pilight
````

This will clone the complete source to your local machine. Navigate to the project folder
and install all needed dependencies via **npm**:

````
$ npm install
````

The project is now installed and ready to use.

## Developing

Assuming you have installed the reopsitory at `/home/user/git/plugins/homebrige-pilight`, you only 
have to configure your local `homebridge` to use this plugins.

For example: `homebridge --plugin-path /home/user/git/plugins`

## Contributing/Submitting changes

Note: In general, pull requests should be based on the `master` branch. No `canary`!

- Checkout a new branch based on <code>master</code> and name it to what you intend to do:
  - Example:
    ````
    $ git checkout -b BRANCH_NAME
    ````
  - Use one branch per fix/feature
- Make your changes
  - Make sure to provide a spec for unit tests.
  - When all tests pass, everything's fine.
- Commit your changes
  - Please provide a git message which explains what you've done.
  - This repo uses [conventional-changelog task](https://github.com/ajoslin/conventional-changelog) so please make sure your commits follow the [conventions](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit).
  - Commit to the forked repository.
- Make a pull request
  - Make sure you send the PR to the <code>master</code> branch.
  - Travis CI and a Hound are watching you!

If you follow these instructions, your PR will land pretty safety!
