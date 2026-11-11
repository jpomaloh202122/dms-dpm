# AWS hosting for the DPM pilot

## Deployment choice

Run one Next.js container on an x86 EC2 instance with encrypted gp3 EBS storage. Store records and document attachments together in SQLite on the host-mounted /srv/dms/data directory. The /srv/dms/backups directory holds consistent database exports. Container updates preserve these directories.

Use Systems Manager port forwarding for pilot access. The instance security group needs zero inbound rules. The app binds only to loopback on the host. Staff identity and office permissions are a future application enhancement. This deployment is a shared pilot for sample records.

## Prerequisites and instance setup

Select a DPM-approved AWS account and region. Create an Ubuntu 24.04 x86 EC2 instance, starting with t3.small and 40 GiB encrypted gp3 storage. Put it in an existing subnet with outbound connectivity for Systems Manager, ECR and OS packages. A public subnet needs an internet gateway route and a public address. A private subnet needs appropriate outbound access such as NAT. Keep the security group free of inbound rules.

Attach an instance profile with AmazonSSMManagedInstanceCore and ECR read permissions restricted to the dms-dpm repository, plus ecr:GetAuthorizationToken on all resources. Verify that the instance is Online under Systems Manager. Set the root EBS volume DeleteOnTermination to false as an additional recovery measure, and tag it for identification. Establish a daily AWS Backup policy for the volume with 30 days retention and verify backup jobs succeed.

Install Docker Engine and the Compose plugin using Docker's official Ubuntu instructions. Enable the Docker service at boot. Install AWS CLI v2 on the instance. Administrative access is through Systems Manager. On an administrative workstation, install AWS CLI v2 and the Session Manager plugin.

Prepare the persistent directories on the instance.

```sh
sudo install -d -o 1000 -g 1000 -m 700 /srv/dms/data /srv/dms/backups
```

## Build and push an image

Run from the repository on a workstation with Docker Buildx and authenticated AWS CLI access. Replace the region and account ID before running. Repository creation is a one-time step. Use a unique release tag for each build.

```sh
export AWS_REGION=ap-southeast-2
export DMS_ACCOUNT_ID=YOUR_AWS_ACCOUNT_ID
export DMS_RELEASE=pilot-001
export DMS_REGISTRY="$DMS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
export DMS_IMAGE="$DMS_REGISTRY/dms-dpm:$DMS_RELEASE"

aws ecr create-repository --region "$AWS_REGION" --repository-name dms-dpm --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$DMS_REGISTRY"
docker buildx build --platform linux/amd64 --tag "$DMS_IMAGE" --push .
```

Review the image scan results before using a release.

## Start the container

Place compose.yaml in /opt/dms on the instance using an approved transfer method. Set the same AWS_REGION, DMS_REGISTRY and DMS_IMAGE values in the Systems Manager shell. Run these commands with a Docker-capable administrative account.

```sh
cd /opt/dms
aws ecr get-login-password --region "$AWS_REGION" | sudo docker login --username AWS --password-stdin "$DMS_REGISTRY"
sudo env DMS_IMAGE="$DMS_IMAGE" docker compose pull
sudo env DMS_IMAGE="$DMS_IMAGE" docker compose up -d
sudo env DMS_IMAGE="$DMS_IMAGE" docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

Docker retains the image selection and volume configuration for container restarts. To manage the container later, set DMS_IMAGE again before running Compose commands. Inspect startup failures with docker compose logs web.

## Open the app

On the administrative workstation, substitute the instance ID and selected region.

```sh
aws ssm start-session --region ap-southeast-2 --target i-REPLACE_WITH_INSTANCE_ID --document-name AWS-StartPortForwardingSession --parameters '{"portNumber":["3000"],"localPortNumber":["3000"]}'
```

Keep the tunnel running and open http://127.0.0.1:3000 in the workstation browser. Restrict IAM session access to approved pilot operators. Each operator needs their own AWS session permissions.

## Migrate an existing database

Stop the app before migration. Back up the source database and transfer a consistent SQLite export through an approved secure channel. Place it at /srv/dms/data/dms.sqlite3 with owner 1000:1000 and mode 600, then start the container. The app opens the existing schema directly. Validate document counts, downloads and routing history.

## Back up and restore

Run the included online backup command before updates and on a daily schedule.

```sh
cd /opt/dms
sudo env DMS_IMAGE="$DMS_IMAGE" docker compose exec -T web node scripts/backup.mjs
```

The command prints the completed export path inside /backups. Check the exit status before copying a backup. Replicate completed exports to a private, encrypted, versioned S3 bucket using a host role restricted to its backup prefix. Apply an approved retention period. Keep a separate recovery copy outside the instance and verify a restore before accepting pilot data.

To restore, stop the container, preserve the current database, copy a selected export to /srv/dms/data/dms.sqlite3, set owner 1000:1000 and mode 600, then restart. Verify downloads and correspondence stages. Never overwrite a live SQLite database. The EBS snapshots provide an additional recovery path. Instance or disk failure interrupts the pilot until recovery is completed.

## Update and rollback

Create a backup. Build and push a new unique image tag. Change DMS_IMAGE to the new URI, pull it and run docker compose up -d. Check the health endpoint and a sample workflow. To roll back application code, use the previous image URI and repeat the pull/start steps. Database restore is a separate, deliberate operation.

Keep one container replica. A wider staff rollout requires application login, authorization and an HTTPS entry point. Multiple application instances require a shared database and document storage design.

## Verification limits

The standalone Next.js build and application smoke checks can run in the development workspace. The Docker build, ECR push, EC2 provisioning, backup policy and Systems Manager tunnel require an AWS account and a Docker-enabled environment and must be validated during deployment.

## References

- https://nextjs.org/docs/app/guides/self-hosting
- https://docs.docker.com/engine/install/ubuntu/
- https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html
