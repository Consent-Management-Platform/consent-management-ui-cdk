## Developer set-up

### Install dev tools

Set up Node and npm:
* [Install Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)
* Run `node --version` and verify you are running Node 20 or later
* Run `npm --version` and verify you are running npm 10 or later
* Run `npm -g install typescript` to install TypeScript

Set up CDK CLI:
* Run `npm -g install aws-cdk` to install the CDK CLI
* Run `cdk --version` to validate the CDK CLI has been successfully installed

Set up AWS CLI:
* Follow [the AWS CLI installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) to install the AWS CLI
* Run `aws --version` and verify you are running a version 2 release of the CLI

### Set up environment variables

Run `aws configure` and configure the AWS CLI with your dev account user's access key and secret access key to enable CDK deployments.

### First-time npm project set-up and deployment

Prerequisite set-up of service code packages:
* In the parent directory that contains the consent-management-api-cdk, run `git clone git@github.com:Consent-Management-Platform/consent-management-ui.git`.
* Run `cd consent-management-ui directory && npm install && npm test && npm run build` to install dependencies, validate unit tests, and generate build artifacts for the web server.
* Validate that .next/server/ and .next/static/ have been created.

Note: The above steps are to enable the CDK stacks to locate the service code to upload to S3.  Pending investigation into a way to automatically consume service code artifacts to remove this manual workaround.

Steps to build and deploy CDK stacks:

* Run `npm install` to install project dependencies.
* Run `npm test` and validate all tests pass.
* Run `npx cdk synth` to synthesize CloudFormation templates from your local CDK code and validates succeeds.
* Run `ls cdk.out` and validate that the project's stacks have assets and template JSON files generated in this folder, eg. `ConsentManagementWebsiteStack.template.json`.
* Run `npx cdk bootstrap` to deploy a CDKToolkit CloudFormation stack to your account with prerequisites to deploying CDK applications, validate succeeds.
* Run `npx cdk deploy <ENTER_STACK_NAME_HERE>` to deploy a given stack to your dev account.  Examples below:

```sh
npx cdk deploy ConsentManagementAuthStack && \
npx cdk deploy ConsentManagementWebsiteStack
```

### Updating stack snapshots

This package uses test snapshots to validate in local builds and code reviews that CDK code updates apply the expected changes to CloudFormation templates.

If you make functional changes to CDK code, builds will fail with an `N snapshot(s) failed.` message along with a diff of what the snapshot changes were.

If the changes are as you expect, run `npm test -- -u` to update the snapshots.

## Useful commands

* `npm install`     install local package dependencies
* `npm run clean`   clear generated build artifacts such as cdk.out and node_modules
* `npm run watch`   watch for changes and compile
* `npm test`        compile to js and run jest unit tests
* `npm test -- -u`  update template snapshots
* `npx cdk bootstrap` deploy bootstrap stack to set up your AWS account with prerequisites for deploying your CDK stacks
* `npx cdk deploy <STACK_NAME_HERE>` deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   writes synthesized CloudFormation templates to cdk.out/

## Troubleshooting

### Running `npm run build` fails with `Cannot find module` errors

You may need to run `npm install` to install this package's dependencies.
