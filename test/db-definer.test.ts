import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { DbDefinerStack } from "../lib/db-definer-stack";

describe("my stack test", () => {
  // Stack を定義
  const app = new cdk.App();
  const stack = new DbDefinerStack(app, "MyTestStack", { auroraInstanceNumber: 1 });
  const template = Template.fromStack(stack);

  // Snapshot Test
  test("Snapshot test", () => {
    expect(template).toMatchSnapshot();
  });

  // Fine Grained Test
  // Auroraが目的の数だけ生成されていることを確認
  test("Aurora Created", () => {
    template.resourceCountIs("AWS::RDS::DBCluster", 1);
  });

  // Lambda の Properties を確認（本来は Function Name も指定する）
  test("Lambda has Valid Properties", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      MemorySize: 256,
      Environment: {
        Variables: {
          DB_SECRET_NAME: Match.anyValue(),
          DB_ENGINE_FAMILY: Match.anyValue(),
          DB_NAME: Match.anyValue(),
        },
      },
    });
  });

  // validation が Error を返すことを確認する
  test("Validation Test", () => {
    expect(() => {
      new DbDefinerStack(app, "ValidationTest", { auroraInstanceNumber: 3 });
    }).toThrowError(/Aurora Instances must be 1 or 2/);
  });
});
