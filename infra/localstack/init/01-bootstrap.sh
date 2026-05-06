#!/usr/bin/env bash
set -euo pipefail

BUCKET="${BUCKET_NAME:-dwci-local}"
FN="${FUNCTION_NAME:-dwci-fn}"

echo "[bootstrap] creating bucket $BUCKET"
awslocal s3api create-bucket --bucket "$BUCKET" >/dev/null

echo "[bootstrap] creating IAM role"
awslocal iam create-role \
  --role-name dwci-lambda-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }' >/dev/null

echo "[bootstrap] creating function $FN from /var/lib/localstack/lambda.zip"
awslocal lambda create-function \
  --function-name "$FN" \
  --runtime nodejs22.x \
  --role arn:aws:iam::000000000000:role/dwci-lambda-role \
  --handler handler.handler \
  --timeout 30 \
  --memory-size 256 \
  --zip-file fileb:///var/lib/localstack/lambda.zip \
  --environment "Variables={BUCKET_NAME=$BUCKET,STATE_KEY=$STATE_KEY,INDEX_KEY=$INDEX_KEY,RSS_URL=$RSS_URL}" \
  >/dev/null

echo "[bootstrap] waiting for function to be Active"
awslocal lambda wait function-active-v2 --function-name "$FN"

echo "[bootstrap] done — invoke with: awslocal lambda invoke --function-name $FN /tmp/out.json"
