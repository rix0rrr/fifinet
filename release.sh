#!/bin/bash
set -eu
npm version ${1:-patch}
