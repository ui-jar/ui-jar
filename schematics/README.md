# Ui-jar Schematics

## ng add import

```
ng add ui-jar
```

If you installed ui-jar with this command, you can skip step 1 because the `ng-add` schematic installs the package and call the `generate-uijar-project` schematic to set up the initial ui-jar project

## 1 - Set up an initial ui-jar project

```
ng g ui-jar:generate-uijar-project
```

- creates a project named 'ui-jar' in the projects directory of the Angular workspace
- downloads the ui-jar dependency
- sets up the project : adds script to package.json file, updates tsconfig.app.json, replaces main.ts and index.html files

This initial project works for the default project (if not skipped) created within the Angular workspace by the `ng new` command

### Run the style guide

```
npm run start:ui-jar
```

## 2 - Add configuration for a specific project or library

```
ng g ui-jar-schematics:add-uijar-doc [options]
```

- creates a specific tsconfig.app.json for the project or the library
- add build configuration is angular.json file corresponding to the new documentation to generate for the project or the library : this will specify the output directory and the tsconfig.app.json that will replace the initial one
- adds script to package.json file

```
options :

--project=name (a prompt asks it if not specified)
```

### Run the style guide for the specific project or library

```
npm run start:ui-jar:{project-name}
```
