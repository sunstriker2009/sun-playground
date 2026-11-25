<!-- SUN BRANDING START -->
# Playground by Sun

A searchable workspace for customizing and reusing Git, JavaScript, C#, and XPath snippets.
<!-- SUN BRANDING END -->

## Snippet workspace

[Open Playground](https://sunstriker2009.github.io/sun-playground/)

Playground is an interactive reference for Git, JavaScript, C#, and XPath. Choose a language or topic under **Filters → Catalogs**, or search all catalogs by task or exact syntax. Browse or search up to eight results per page. Favorites appear first, with each group sorted alphabetically by snippet title. Open a snippet for a worked example and a shareable link. Use **Copy link** to share a snippet, **Jump to builder** to edit its parameters, or **Full screen** to focus on its detail. Mark it as a favorite to find it again with the **Favorites** filter. Favorites are saved in the current browser. Edit its parameters in the builder and copy the generated code, or save a named variant to reuse its values. Variants are scoped to the current browser and site. Saving a variant with the same name replaces it for that snippet.

### Tags

Use **+** beside **Tags** to add a tag, or remove an existing tag from its chip. Tags stay in the current browser. Open **Filters → Tags** and select one or more tags. A snippet matches if it has any selected tag. Text search, catalog or topic, **Saved**, and **Favorites** still combine with the tag selection. Use **All catalogs** or remove the catalog chip to search across the library. Remove any active filter chip to clear that filter.

### Moving from CodeFolio

Playground uses the same snippet IDs and browser storage keys as the original workspace. On the same GitHub Pages host, open Playground in the browser where you saved your snippets. Your variants, tags, and favorites will be available there. To move to another browser or device, export an all-catalog personal backup and import the JSON file in Playground.

### Run locally

Serve the repository root over HTTP, for example with Python 3.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://localhost:8000>. The workspace runs in the browser and only generates text for you to copy. Clipboard access uses localhost or HTTPS, with manual selection available when the clipboard is blocked.

### Git history variants

In the running workspace, open **View a file’s commit history** and enter a path relative to the repository root.

| Variant name | Local branch | Commit count | Show file change details |
| --- | --- | --- | --- |
| Release review | A local release branch, such as `release/v1` | 10 | On |
| Daily changelog | Leave blank for the current branch | 5 | Off |

Enter the name and select **Save variant**. Reopen the snippet later and select the saved name to restore the fields. You can edit the values and copy the new command, or save the edited values again.

Check **Saved** in **Filters** to show snippets with saved variants and open the backup controls. Choose a catalog or topic under **Filters → Catalogs** to set the backup scope. **Export** downloads a JSON backup of your saved variants, tags, and favorites. **Import** merges entries within the current selection and accepts older variant-only backups. Choose **All catalogs** while in **Saved** to transfer all your data. Import adds missing favorites and tags and skips tags that already match by name regardless of case. For variants, import checks names within a language and topic, such as C# → Regex. It skips matching variants for the same snippet. A name already used by another snippet in that category, or by the same snippet with different settings, gets an “(imported)” suffix. The same name can be reused in another category.

Use **Share** with **Saved** checked to send the current selection’s JSON file through the device’s share menu. Available apps depend on the device and which apps accept the file. If file sharing is unavailable, use **Export** and attach the downloaded JSON in your messaging or email app.

### Maintain the catalog

Add entries to `app/catalog.mjs`. Give each snippet a stable ID, language, topic, search aliases and use cases, a worked example with prerequisites and expected behavior, and related snippet IDs. Define typed fields and defaults, then verify the generated example against its target shell, runtime, or evaluator before opening a PR.

Run the catalog checks with Node.js 24.

```sh
node --test tests/catalog.test.mjs
```

Run the C# Regex and LINQ runtime tests with Node.js 24 and the .NET 10 SDK. The console project uses the catalog builder to generate C# during the build, then compiles and executes it. GitHub Actions runs the same command.

```sh
dotnet run --project tests/runtime/csharp/CodeFolio.CSharp.RuntimeTests.csproj --configuration Release
```

Run the Git runtime tests with Node.js 24, Git, and a POSIX shell. The suite executes generated commands against a temporary repository with known history, branches, and tags. GitHub Actions runs the same command.

```sh
node --test tests/runtime/git/catalog.test.mjs
```

Run the JavaScript runtime tests with Node.js 24. They execute generated filter, join, and property-extraction snippets against fixed inputs.

```sh
node --test tests/runtime/javascript/catalog.test.mjs
```

Run the XPath runtime tests with Node.js 24 and the .NET 10 SDK. The suite builds the catalog’s XPath expressions, evaluates them against XML, and checks which nodes they select.

```sh
node tests/runtime/xpath/generate-tests.mjs |
  dotnet run --project tests/runtime/xpath/CodeFolio.XPath.RuntimeTests.csproj --configuration Release
```

Keep runtime suites under `tests/runtime/<catalog>`. Add C# cases in `tests/runtime/csharp/generate-tests.mjs` with the snippet ID, any input overrides, and assertions for the generated code’s behavior.

When changing the page markup or frontend modules together, update their asset version query strings in `index.html` and `app/workspace.mjs` so a browser can fetch the matching files after a Pages deployment.
