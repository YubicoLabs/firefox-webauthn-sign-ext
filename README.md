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
The branch with the prototype FIDO `sign` extension is [`fido-sign-ext`](https://github.com/YubicoLabs/firefox-webauthn-sign-ext/tree/fido-sign-ext).


# Building

To build, check out the [`fido-sign-ext`](https://github.com/YubicoLabs/firefox-webauthn-sign-ext/tree/fido-sign-ext) branch
and run `./mach build`:

```
$ git clone https://github.com/YubicoLabs/firefox-webauthn-sign-ext.git
$ cd firefox-webauthn-sign-ext
$ ./mach build
```

Building from scratch typically takes about 20 minutes on a powerful desktop machine,
and may take upwards of 1 or 2 hours on a typical laptop.
Subsequent rebuilds of small changes typically take between 15 seconds and 2 minutes depending on host performance.

See the [Firefox Source Docs](https://firefox-source-docs.mozilla.org/setup/index.html)
for much more comprehensive documentation.

Once built, use `./mach run` to launch the browser:

```
$ ./mach run
```

To enable debug logging, use the `MOZ_LOG` environment variable:

```
$ MOZ_LOG=authenticator::*:4,authrs_bridge::*:4,webauthnmanager:4 ./mach run
```

(The `::*` infix is used for modules implemented in Rust).
