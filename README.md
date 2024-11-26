This is a branch of Mozilla Firefox prototyping the [proposed WebAuthn `sign` extension](https://github.com/w3c/webauthn/pull/2078).

The [upstream Firefox repository](https://hg.mozilla.org/mozilla-central) is hosted in Mercurial,
not Git, so this clone was created
[using Git Cinnabar](https://firefox-source-docs.mozilla.org/setup/linux_build.html#bootstrap-a-copy-of-the-firefox-source-code)
to port it to Git.
This has the consequence that **unrelated Git Cinnabar clones from the Mercurial source have unrelated histories!**

Therefore, pulling changes from the Mercurial upstream can only be done through one Git clone -
pulling the same changes into two Git clones independently will make the Git clones diverge.
Therefore, **sync with any other collaborators working with this repo** before pulling changes from upstream.

This `main` branch is empty. The upstream main branch is `bookmarks/central`.
