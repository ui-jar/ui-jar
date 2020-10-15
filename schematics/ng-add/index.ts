import { Rule, schematic } from '@angular-devkit/schematics'

export default function(_options: any): Rule {
  return schematic('generate-uijar-project', {})
}
