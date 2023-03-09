import { Stack, StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Database } from "./database";
import { AuroraInstanceNumberValidator } from "./validator";

interface DbDefinerStackProps extends StackProps {
  auroraInstanceNumber: number;
}

export class DbDefinerStack extends Stack {
  constructor(scope: Construct, id: string, props: DbDefinerStackProps) {
    super(scope, id, props);

    // Parametor のバリデーション
    if (props.auroraInstanceNumber !== undefined && (props.auroraInstanceNumber < 1 || props.auroraInstanceNumber > 2)) {
      throw new Error("Aurora Instances must be 1 or 2");
    }

    const vpc = new ec2.Vpc(this, "Vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "db",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: "bastion",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    new Database(this, "DB", {
      vpc,
      auroraInstanceNumber: props.auroraInstanceNumber,
    });
  }
}
