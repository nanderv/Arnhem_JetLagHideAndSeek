NVM_DIR := $(HOME)/.nvm
NVM_SH := /opt/homebrew/opt/nvm/nvm.sh

.PHONY: build

build:
	. "$(NVM_SH)" && nvm use 24 && pnpm build
