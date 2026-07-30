# GitHub Publication and Pages Deployment

## Recommended repository

```text
masarray/line-differential-relay-lab
```

Recommended description:

> Industrial real-time 87L line differential relay laboratory for communication delay, secure window, GPS synchronization, confidence, and bounded waveform tracking.

Recommended topics:

```text
87l
line-differential
protection-relay
power-system-protection
substation-automation
relay-testing
waveform-tracking
github-pages
power-engineering
education
```

## First publication

Create an empty **public** repository without an auto-generated README, then run from the extracted project folder:

```bash
git remote add origin https://github.com/masarray/line-differential-relay-lab.git
git push -u origin main
```

The local package already contains an initial `main` commit.

## Enable Pages

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Open **Actions** and run **Deploy GitHub Pages**, or push a new commit to `main`.
4. The expected URL is:

```text
https://masarray.github.io/line-differential-relay-lab/
```

## Repository settings checklist

- Enable Issues and Discussions.
- Enable private vulnerability reporting.
- Require pull requests for `main` after the first publication.
- Require the `validate` status check.
- Require conversation resolution.
- Disable force pushes and branch deletion on `main`.
- Enable Dependabot security updates.
- Add the repository topics listed above.
- Upload `docs/assets/simulator-preview.png` as the social preview.

## Releases

Push an annotated semantic-version tag:

```bash
git tag -a v0.1.0 -m "Initial public laboratory release"
git push origin v0.1.0
```

The release workflow validates the project and publishes a deployable Pages ZIP.
