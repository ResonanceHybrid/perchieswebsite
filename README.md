# Perchies website

The website for [Perchies](https://play.google.com/store/apps/details?id=com.perchies.pets), tiny animated pets that live on your screen.

Plain HTML, CSS and JavaScript. No build step.

- `index.html` home, with live pets you can drag, fling and feed
- `privacy.html`, `terms.html`, `support.html`
- `assets/js/pets.js` the pet engine (walk, hop onto page elements, climb, parachute, drag, feed)
- `assets/pets/` sprite sheets for 39 characters, `pets.json` describes them

## Run locally

```
npx serve .
```

ES modules need a server, so opening `index.html` straight from disk won't load the pets.

## Rights

The Perchies name, characters and artwork are not open source. All rights reserved.
