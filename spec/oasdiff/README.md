# spec/oasdiff

Configuration for the breaking-change gate.

## How the gate works

In `.github/workflows/ci.yml`, the `breaking-changes` job runs on every pull
request. It:

1. Takes the committed bundle `spec/dist/apx-v1.yaml` from the base branch.
2. Compares it with the bundle in the pull request, using oasdiff.
3. Fails the build on any finding at level ERR.

## err-ignore.txt

`err-ignore.txt` lists findings that are accepted on purpose. Each line names
one method, path and change. Rules from the file's own header:

- Add a line only for a change the pull request description explains is
  additive.
- Empty the file after the release that ships the change.

The file currently holds only its header comment.
