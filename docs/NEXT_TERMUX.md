# First commands in Termux

After creating an empty GitHub repository named `vinss-canton`:

```bash
cd ~
mkdir -p vinss-canton
cd vinss-canton
```

Copy/extract this scaffold into the directory, then:

```bash
npm install
npm run typecheck
npm test
```

Initialize and push:

```bash
git init
git add .
git commit -m "chore: bootstrap VINSS Canton secure messaging core"
git branch -M main
git remote add origin https://github.com/<OWNER>/vinss-canton.git
git push -u origin main
```

Do **not** try to compile the OpenMLS WASM crate on Termux yet. The first milestone is to keep the TypeScript boundaries clean; the WASM build can be produced in Linux CI and consumed by the browser app.
