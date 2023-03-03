import { Construct } from "constructs";
import { Duration, CfnOutput } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { readFileSync } from "fs";

export interface DatabaseProps {
  vpc: ec2.IVpc;
}

// データベース
export class Database extends Construct {
  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    const databaseName = "prototype";

    const engine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_13_7,
    });

    const dbCluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: engine,
      defaultDatabaseName: databaseName,
      instances: 1,
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        vpc: props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      },
    });

    dbCluster.connections.allowDefaultPortFrom(ec2.Peer.ipv4(props.vpc.vpcCidrBlock));
    const secret = dbCluster.secret!;

    new ec2.InterfaceVpcEndpoint(this, "VpcEndpoint", {
      vpc: props.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    // DBを初期化するLambda
    const dbDefiner = new lambda.DockerImageFunction(this, "DbDefiner", {
      code: lambda.DockerImageCode.fromImageAsset("lambda/db-definer"),
      memorySize: 256,
      timeout: Duration.seconds(300),
      vpc: props.vpc,
      environment: {
        DB_SECRET_NAME: secret.secretName,
        DB_ENGINE_FAMILY: dbCluster.engine?.engineFamily!,
        DB_NAME: databaseName,
      },
    });
    secret.grantRead(dbDefiner);

    // Aurora へクエリ投げるための踏み台サーバ
    const userDataScript = readFileSync("./lib/resources/user-data.sh", "utf8");

    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    const ec2Role = new iam.Role(this, "BastionServerRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });

    const bastion = new ec2.Instance(this, "BastionServer", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      machineImage: ami,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      role: ec2Role,
    });

    bastion.addUserData(userDataScript);
    bastion.connections.allowTo(dbCluster, ec2.Port.tcp(5432));

    // DB初期化のコマンド例
    new CfnOutput(this, "DBInitCommand", {
      value: `aws lambda invoke --function-name ${dbDefiner.functionName} --payload '{"command":"init"}' --cli-binary-format raw-in-base64-out res.txt`,
    });

    // 踏み台サーバーからDBへのアクセスコマンド例
    new CfnOutput(this, "DBLoginCommand", {
      value: `PGPASSWORD=<DB Password from Secret Manager> \
      psql -h ${dbCluster.clusterEndpoint.hostname} \
      -U postgres prototype`,
    });
  }
}
