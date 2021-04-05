#!/bin/bash
set -eu
npm version ${1:-patch}
git push
git push --tags
