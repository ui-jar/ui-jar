import {
  Rule,
  SchematicContext,
  Tree,
  chain,
  SchematicsException
} from '@angular-devkit/schematics'
import { getWorkspace, updateWorkspace } from '@schematics/angular/utility/config'
import { getProjectTargets } from '@schematics/angular/utility/project-targets'
import { ProjectType } from '@schematics/angular/utility/workspace-models'

import { Schema as AddUiJarDocOptions } from './schema'

export default function(options: AddUiJarDocOptions): Rule {
  return (_tree: Tree, _context: SchematicContext) => {
    if (!options.project) {
      throw new SchematicsException(`Invalid options, "project" is required.`)
    }

    return chain([
      createDocTsConfig(options),
      addBuildConfigToAngularJson(options),
      addScriptsToPackageJson(options)
    ])
  }
}

function createDocTsConfig(options: AddUiJarDocOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const docTsConfigJson = JSON.parse(
      tree.read('./projects/ui-jar/tsconfig.app.json')!.toString('utf-8')
    )

    docTsConfigJson.exclude = ['test.ts', '**/*.spec.ts', `../${options.project}/src/**/*.spec.ts`]
    docTsConfigJson.include = ['**/*.ts', `../${options.project}/src/**/*.ts`]

    tree.create(
      `./projects/ui-jar/tsconfig-${options.project}.app.json`,
      JSON.stringify(docTsConfigJson, null, 2)
    )
  }
}

function addBuildConfigToAngularJson(options: AddUiJarDocOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const workspace = getWorkspace(tree)
    const uiJarBuildConfig = getProjectTargets(workspace, 'ui-jar').build!.configurations!
    const uiJarServeConfig = getProjectTargets(workspace, 'ui-jar').serve!.configurations!

    uiJarBuildConfig[`${options.project}`] = {
      tsConfig: `projects/ui-jar/tsconfig-${options.project}.app.json`
    }

    uiJarBuildConfig[`production-${options.project}`] = {
      ...uiJarBuildConfig.production,
      outputPath: `dist/ui-jar/${options.project}`,
      tsConfig: `projects/ui-jar/tsconfig-${options.project}.app.json`
    }

    uiJarServeConfig[options.project] = {
      browserTarget: `ui-jar:build:${options.project}`
    }

    uiJarServeConfig[`production-${options.project}`] = {
      browserTarget: `ui-jar:build:production-${options.project}`
    }

    return updateWorkspace(workspace)
  }
}

function addScriptsToPackageJson(options: AddUiJarDocOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const subDirectories = {
      [ProjectType.Application]: 'app',
      [ProjectType.Library]: 'lib'
    }
    const projectType = getWorkspace(tree).projects[options.project].projectType
    const srcDirectory = `./projects/${options.project}/src/${subDirectories[projectType]}/`

    const json = JSON.parse(tree.read('./package.json')!.toString('utf-8'))

    json.scripts[
      `start:ui-jar:${options.project}`
    ] = `node node_modules/ui-jar/dist/bin/cli.js --directory ${srcDirectory} --includes \\.ts$ && ng serve ui-jar -c=${
      options.project
    }`

    tree.overwrite('./package.json', JSON.stringify(json, null, 2))
  }
}
