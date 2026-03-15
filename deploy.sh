#!/bin/bash

# Iris - Google Cloud Run Deploy Script
# Usage: ./deploy.sh <YOUR_GEMINI_API_KEY> <YOUR_GCP_PROJECT_ID>

set -e

API_KEY=${1:?"Usage: ./deploy.sh <GEMINI_API_KEY> <GCP_PROJECT_ID>"}
PROJECT_ID=${2:?"Usage: ./deploy.sh <GEMINI_API_KEY> <GCP_PROJECT_ID>"}
SERVICE_NAME="iris-spatial-agent"
REGION="us-central1"

echo "Setting GCP project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

echo "Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

echo "Building and deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --build-arg "REACT_APP_GEMINI_API_KEY=$API_KEY" \
  --port 8080

echo "Deployment complete!"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)"
