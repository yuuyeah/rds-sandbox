#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DbDefinerStack } from "../lib/db-definer-stack";

const app = new cdk.App();

new DbDefinerStack(app, "DbDefinerStack");
