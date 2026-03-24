#!/usr/bin/env bash
# GCP / Cloud Run デプロイ初期セットアップスクリプト
# 初回のみ実行。以降のデプロイは GitHub Actions が自動で行う。
#
# 前提:
#   - gcloud CLI がインストール済み・ログイン済み
#   - PROJECT_ID, GITHUB_ORG, GITHUB_REPO を環境変数で設定するか、以下の変数を編集してください

set -euo pipefail

# ── 変数（必要に応じて変更） ────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-tsukineko-grimoire-dev}"
REGION="${REGION:-asia-northeast1}"
SERVICE_NAME="${SERVICE_NAME:-tsukineko-grimoire}"
GITHUB_ORG="${GITHUB_ORG:-nekoai-lab}"
GITHUB_REPO="${GITHUB_REPO:-tsukineko-grimoire}"
AR_REPO="tsukineko-grimoire"                        # Artifact Registry リポジトリ名
SA_NAME="github-actions-deploy"                     # デプロイ用サービスアカウント
WIF_POOL="github-pool"                              # Workload Identity プール名
WIF_PROVIDER="github-provider"                      # Workload Identity プロバイダ名
# ────────────────────────────────────────────────────────────────────────

echo "🔧 Project: $PROJECT_ID  Region: $REGION"
gcloud config set project "$PROJECT_ID"

# ① 必要な API を有効化
echo "📦 Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com

# ② Artifact Registry リポジトリを作成
echo "🗄️  Creating Artifact Registry repo..."
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="tsukineko-grimoire Docker images" \
  || echo "(already exists — skip)"

# ③ デプロイ用サービスアカウントを作成
echo "👤 Creating service account..."
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="GitHub Actions Deploy SA" \
  || echo "(already exists — skip)"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# ④ サービスアカウントに権限を付与
echo "🔑 Granting roles to service account..."
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.writer \
  roles/secretmanager.secretAccessor \
  roles/iam.serviceAccountUser \
  roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --quiet
done

# ⑤ Workload Identity Federation プールを作成
echo "🌐 Setting up Workload Identity Federation..."
gcloud iam workload-identity-pools create "$WIF_POOL" \
  --location=global \
  --display-name="GitHub Actions Pool" \
  || echo "(already exists — skip)"

WIF_POOL_ID=$(gcloud iam workload-identity-pools describe "$WIF_POOL" \
  --location=global \
  --format="value(name)")

# ⑥ GitHub OIDC プロバイダを作成
gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
  --workload-identity-pool="$WIF_POOL" \
  --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --attribute-condition="assertion.repository=='${GITHUB_ORG}/${GITHUB_REPO}'" \
  || echo "(already exists — skip)"

# ⑦ サービスアカウントに Workload Identity の借用を許可
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WIF_POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"

# ⑧ Cloud Run のランタイム用サービスアカウントに権限付与
# （Cloud Run が Secret Manager / Storage / Vertex AI を使うために必要）
RUNTIME_SA="$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo 'N/A')"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ セットアップ完了！"
echo ""
echo "GitHub Secrets に以下の値を登録してください:"
echo ""
echo "WIF_PROVIDER:"
gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --workload-identity-pool="$WIF_POOL" \
  --location=global \
  --format="value(name)"
echo ""
echo "WIF_SERVICE_ACCOUNT: ${SA_EMAIL}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
