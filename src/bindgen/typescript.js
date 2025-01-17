import fs from 'fs-extra'
import path from 'path'

import { markdownTable } from 'markdown-table'
import wasmBinaryInterfaceJson from './wasmBinaryInterfaceJson.js'
import interfaceJsonTypeToInterfaceType from './interfaceJsonTypeToInterfaceType.js'
import camelCase from './camelCase.js'

const interfaceJsonTypeToTypeScriptType = new Map([
  ['INPUT_TEXT_FILE:FILE', 'TextFile'],
  ['INPUT_TEXT_FILE', 'TextFile'],
  ['OUTPUT_TEXT_FILE:FILE', 'TextFile'],
  ['OUTPUT_TEXT_FILE', 'TextFile'],
  ['INPUT_BINARY_FILE:FILE', 'BinaryFile'],
  ['INPUT_BINARY_FILE', 'BinaryFile'],
  ['OUTPUT_BINARY_FILE:FILE', 'BinaryFile'],
  ['OUTPUT_BINARY_FILE', 'BinaryFile'],
  ['INPUT_TEXT_STREAM', 'string'],
  ['OUTPUT_TEXT_STREAM', 'string'],
  ['INPUT_BINARY_STREAM', 'Uint8Array'],
  ['OUTPUT_BINARY_STREAM', 'Uint8Array'],
  ['INPUT_IMAGE', 'Image'],
  ['OUTPUT_IMAGE', 'Image'],
  ['INPUT_MESH', 'Mesh'],
  ['OUTPUT_MESH', 'Mesh'],
  ['INPUT_POLYDATA', 'PolyData'],
  ['OUTPUT_POLYDATA', 'PolyData'],
  ['BOOL', 'boolean'],
  ['TEXT', 'string'],
  ['INT', 'number'],
  ['UINT', 'number'],
  ['FLOAT', 'number'],
  ['OUTPUT_JSON', 'Object'],
])

// Array of types that will require an import from itk-wasm
const typesRequireImport = ['Image', 'Mesh', 'PolyData', 'TextFile', 'BinaryFile', 'TextFile', 'BinaryFile']

function bindgenResource(filePath) {
  return path.join(path.dirname(import.meta.url.substring(7)), 'typescript-resources', filePath)
}

function typescriptBindings(outputDir, buildDir, wasmBinaries, options, forNode=false) {
  // index module
  let indexContent = ''
  const nodeTextKebab = forNode ? '-node' : ''
  const nodeTextCamel = forNode ? 'Node' : ''

  const srcOutputDir = path.join(outputDir, 'src')
  try {
    fs.mkdirSync(srcOutputDir, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }

  let readmeInterface = ''
  let readmePipelines = ''

  const packageName = options.packageName
  const bundleName = path.basename(packageName)
  const packageJsonPath = path.join(outputDir, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(bindgenResource('template.package.json')))
    packageJson.name = packageName
    packageJson.description = options.packageDescription
    packageJson.module = `./dist/bundles/${bundleName}.js`
    packageJson.exports['.'].browser = `./dist/bundles/${bundleName}.js`
    packageJson.exports['.'].node = `./dist/bundles/${bundleName}.node.js`
    packageJson.exports['.'].default = `./dist/bundles/${bundleName}.js`
    if(options.repository) {
      packageJson.repository = { 'type': 'git', 'url': options.repository }
    }
    if(options.packageVersion) {
      packageJson.version = options.packageVersion
    } else {
      packageJson.version = "0.1.0"
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  } else {
    if (options.packageVersion) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath))
      packageJson.version = options.packageVersion
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }
  }

  if (!forNode) {
    indexContent += "export * from './pipelines-base-url.js'\n"
    indexContent += "export * from './pipeline-worker-url.js'\n"
    try {
      fs.mkdirSync(path.join(outputDir, 'build'), { recursive: true })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
    try {
      fs.mkdirSync(path.join(outputDir, 'test', 'browser'), { recursive: true })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }

    const npmIgnorePath = path.join(outputDir, '.npmignore')
    if (!fs.existsSync(npmIgnorePath)) {
      fs.copyFileSync(bindgenResource('npmignore.bindgen'), npmIgnorePath)
    }

    const docsIndexPath = path.join(outputDir, 'index.html')
    if (!fs.existsSync(docsIndexPath)) {
      let docsIndexContent = fs.readFileSync(bindgenResource('index.html'), { encoding: 'utf8', flag: 'r' })
      docsIndexContent = docsIndexContent.replaceAll('<bindgenPackageName>', packageName)
      docsIndexContent = docsIndexContent.replaceAll('<bindgenPackageDescription>', options.packageDescription)
      fs.writeFileSync(docsIndexPath, docsIndexContent)
      fs.copyFileSync(bindgenResource('.nojekyll'), path.join(outputDir, '.nojekll'))
    }

    const logoPath = path.join(outputDir, 'test', 'browser', 'logo.svg')
    if (!fs.existsSync(logoPath)) {
      fs.copyFileSync(bindgenResource('logo.svg'), logoPath)
    }

    const demoStylePath = path.join(outputDir, 'test', 'browser', 'style.css')
    if (!fs.existsSync(demoStylePath)) {
      fs.copyFileSync(bindgenResource('demo.css'), demoStylePath)
    }

    const indexPath = path.join(outputDir, 'test', 'browser', 'index.html')
    if (!fs.existsSync(indexPath)) {
      let demoIndexContent = fs.readFileSync(bindgenResource('demo-index.html'), { encoding: 'utf8', flag: 'r' })
      demoIndexContent = demoIndexContent.replaceAll('<bindgenPackageName>', packageName)
      fs.writeFileSync(indexPath, demoIndexContent)
    }

    const demoPath = path.join(outputDir, 'test', 'browser', 'app.ts')
    if (!fs.existsSync(demoPath)) {
      let demoContent = fs.readFileSync(bindgenResource('demo.ts'), { encoding: 'utf8', flag: 'r' })
      demoContent = demoContent.replaceAll('<bindgenBundleName>', bundleName)
      demoContent = demoContent.replaceAll('<bindgenBundleNameCamelCase>', camelCase(bundleName))
      fs.writeFileSync(demoPath, demoContent)
    }

    const rollupConfigPath = path.join(outputDir, 'build', 'rollup.browser.config.js')
    if (!fs.existsSync(rollupConfigPath)) {
      fs.copyFileSync(bindgenResource('rollup.browser.config.js'), rollupConfigPath)
    }

    const viteConfigPath = path.join(outputDir, 'build', 'vite.config.js')
    if (!fs.existsSync(viteConfigPath)) {
      fs.copyFileSync(bindgenResource('vite.config.js'), viteConfigPath)
    }
  }

  if (forNode) {
    const rollupConfigPath = path.join(outputDir, 'build', 'rollup.node.config.js')
    if (!fs.existsSync(rollupConfigPath)) {
      fs.copyFileSync(bindgenResource('rollup.node.config.js'), rollupConfigPath)
    }
  }

  const tsConfigPath = path.join(outputDir, 'tsconfig.json')
  if (!fs.existsSync(tsConfigPath)) {
    fs.copyFileSync(bindgenResource('tsconfig.json'), tsConfigPath)
  }

  wasmBinaries.forEach((wasmBinaryName) => {
    let wasmBinaryRelativePath = `${buildDir}/${wasmBinaryName}`
    if (!fs.existsSync(wasmBinaryRelativePath)) {
      wasmBinaryRelativePath = wasmBinaryName
    }
    const distPipelinesDir = path.join(outputDir, 'dist', 'pipelines')
    try {
      fs.mkdirSync(distPipelinesDir, { recursive: true })
    } catch (err) {
      if (err.code !== 'EEXIST') throw err
    }
    fs.copyFileSync(wasmBinaryRelativePath, path.join(distPipelinesDir, path.basename(wasmBinaryRelativePath)))
    const prefix = wasmBinaryRelativePath.substring(0, wasmBinaryRelativePath.length-5)
    fs.copyFileSync(`${prefix}.js`, path.join(distPipelinesDir, `${path.basename(prefix)}.js`))
    fs.copyFileSync(`${prefix}.umd.js`, path.join(distPipelinesDir, `${path.basename(prefix)}.umd.js`))

    const { interfaceJson, parsedPath } = wasmBinaryInterfaceJson(outputDir, buildDir, wasmBinaryName)

    const moduleKebabCase = parsedPath.name
    const moduleCamelCase = camelCase(parsedPath.name)
    const modulePascalCase = `${moduleCamelCase[0].toUpperCase()}${moduleCamelCase.substring(1)}`

    readmeInterface += `  ${moduleCamelCase}${nodeTextCamel},\n`
    let readmeFunction = ''
    let readmeResult = ''
    let readmeOptions = ''

    // -----------------------------------------------------------------
    // Result module
    let resultContent = `interface ${modulePascalCase}${nodeTextCamel}Result {\n`
    const readmeResultTable = [ ['Property', 'Type', 'Description'], ]
    readmeResult += `\n**\`${modulePascalCase}${nodeTextCamel}Result\` interface:**\n\n`
    if (!forNode) {
      resultContent += `  /** WebWorker used for computation */\n  webWorker: Worker | null\n\n`
      readmeResultTable.push(['**webWorker**', '*Worker*', 'WebWorker used for computation'])
    }

    // track unique output types in this set
    const resultsImportTypes = new Set()

    interfaceJson.outputs.forEach((output) => {
      if (!interfaceJsonTypeToTypeScriptType.has(output.type)) {

        console.error(`Unexpected output type: ${output.type}`)
        process.exit(1)
      }
      resultContent += `  /** ${output.description} */\n`
      const outputType = interfaceJsonTypeToTypeScriptType.get(output.type)
      if(typesRequireImport.includes(outputType)) {
        resultsImportTypes.add(outputType)
      }
      resultContent += `  ${camelCase(output.name)}: ${outputType}\n\n`
      const readmeOutputArray = output.itemsExpectedMax > 1 ? "[]" : ""
      readmeResultTable.push([`\`${camelCase(output.name)}\``, `*${outputType}${readmeOutputArray}*`, output.description])
    })
    readmeResult += markdownTable(readmeResultTable, { align: ['c', 'c', 'l'] }) + '\n'

    // Insert the import statement in the beginning for the file.
    if(resultsImportTypes.size !== 0)
      resultContent = `import { ${Array.from(resultsImportTypes).join(',')} } from 'itk-wasm'\n\n` + resultContent;

    resultContent += `}\n\nexport default ${modulePascalCase}${nodeTextCamel}Result\n`
    fs.writeFileSync(path.join(srcOutputDir, `${moduleKebabCase}${nodeTextKebab}-result.ts`), resultContent)
    indexContent += `\n\nimport ${modulePascalCase}${nodeTextCamel}Result from './${moduleKebabCase}${nodeTextKebab}-result.js'\n`
    indexContent += `export type { ${modulePascalCase}${nodeTextCamel}Result }\n\n`

    // -----------------------------------------------------------------
    // Options module
    const filteredParameters = interfaceJson.parameters.filter(p => { return p.name !== 'memory-io' && p.name !== 'version'})
    const haveParameters = !!filteredParameters.length

    // track unique output types in this set
    const optionsImportTypes = new Set()

    if (haveParameters) {
      readmeOptions += `\n**\`${modulePascalCase}${nodeTextCamel}Options\` interface:**\n\n`
      const readmeOptionsTable = [ ['Property', 'Type', 'Description'], ]
      let optionsContent = ''
      let optionsInterfaceContent = `interface ${modulePascalCase}Options {\n`
      interfaceJson.parameters.forEach((parameter) => {
        if (parameter.name === 'memory-io' || parameter.name === 'version') {
          // Internal
          return
        }
        if (!interfaceJsonTypeToTypeScriptType.has(parameter.type)) {

          console.error(`Unexpected parameter type: ${parameter.type}`)
          process.exit(1)
        }
        optionsInterfaceContent += `  /** ${parameter.description} */\n`
        const parameterType = interfaceJsonTypeToTypeScriptType.get(parameter.type)
        if(typesRequireImport.includes(parameterType)) {
          optionsImportTypes.add(parameterType)
        }
        const isOptional = parameter.required ? '' : '?'
        if (parameter.itemsExpectedMax > 1) {
          optionsInterfaceContent += `  ${camelCase(parameter.name)}${isOptional}: ${parameterType}[]\n\n`
        } else {
          optionsInterfaceContent += `  ${camelCase(parameter.name)}${isOptional}: ${parameterType}\n\n`
        }
        const readmeParameterArray = parameter.itemsExpectedMax > 1 ? "[]" : ""
        readmeOptionsTable.push([`\`${camelCase(parameter.name)}\``, `*${parameterType}${readmeParameterArray}*`, parameter.description])
      })
      // Insert the import statement in the beginning for the file.
      if(optionsImportTypes.size !== 0)
        optionsContent += `import { ${Array.from(optionsImportTypes).join(',')} } from 'itk-wasm'\n\n`;
      optionsContent += optionsInterfaceContent
      optionsContent += `}\n\nexport default ${modulePascalCase}Options\n`
      fs.writeFileSync(path.join(srcOutputDir, `${moduleKebabCase}-options.ts`), optionsContent)

      indexContent += `import ${modulePascalCase}Options from './${moduleKebabCase}-options.js'\n`
      indexContent += `export type { ${modulePascalCase}Options }\n\n`
      readmeOptions += markdownTable(readmeOptionsTable, { align: ['c', 'c', 'l'] }) + '\n'
    }

    // -----------------------------------------------------------------
    // function module
    let functionContent = `// Generated file. Do not edit.

import {\n`
    const usedInterfaceTypes = new Set()
    const pipelineComponents = ['inputs', 'outputs', 'parameters']
    pipelineComponents.forEach((pipelineComponent) => {
      interfaceJson[pipelineComponent].forEach((value) => {
        if (interfaceJsonTypeToInterfaceType.has(value.type)) {
          const interfaceType = interfaceJsonTypeToInterfaceType.get(value.type)
          usedInterfaceTypes.add(interfaceType)
        }
      })
    })
    usedInterfaceTypes.forEach((interfaceType) => {
      functionContent += `  ${interfaceType},\n`
    })
    functionContent += `  InterfaceTypes,\n`
    functionContent += `  PipelineOutput,\n`
    functionContent += `  PipelineInput,\n`
    if (forNode) {
      functionContent += `  runPipelineNode\n`
    } else {
      functionContent += `  runPipeline\n`

    }
    functionContent += `} from 'itk-wasm'\n\n`
    if (haveParameters) {
      functionContent += `import ${modulePascalCase}Options from './${moduleKebabCase}-options.js'\n`
    }
    functionContent += `import ${modulePascalCase}${nodeTextCamel}Result from './${moduleKebabCase}${nodeTextKebab}-result.js'\n\n`
    if (forNode) {
      functionContent += "\nimport path from 'path'\n\n"
    } else {
      functionContent += "\nimport { getPipelinesBaseUrl } from './pipelines-base-url.js'\n\n"
      functionContent += "\nimport { getPipelineWorkerUrl } from './pipeline-worker-url.js'\n\n"
    }

    const readmeParametersTable = [['Parameter', 'Type', 'Description'],]
    functionContent += `/**\n * ${interfaceJson.description}\n *\n`
    interfaceJson.inputs.forEach((input) => {
      if (!interfaceJsonTypeToTypeScriptType.has(input.type)) {

        console.error(`Unexpected input type: ${input.type}`)
        process.exit(1)
      }
      const typescriptType = interfaceJsonTypeToTypeScriptType.get(input.type)
      functionContent += ` * @param {${typescriptType}} ${camelCase(input.name)} - ${input.description}\n`
      const readmeParameterArray = input.itemsExpectedMax > 1 ? "[]" : ""
      readmeParametersTable.push([`\`${camelCase(input.name)}\``, `*${typescriptType}${readmeParameterArray}*`, input.description])
    })
    functionContent += ` *\n * @returns {Promise<${modulePascalCase}${nodeTextCamel}Result>} - result object\n`
    functionContent += ` */\n`

    readmeFunction += `\n#### ${moduleCamelCase}${nodeTextCamel}\n\n`
    let functionCall = ''
    functionCall += `async function ${moduleCamelCase}${nodeTextCamel}(\n`
    if (!forNode) {
      functionCall += '  webWorker: null | Worker,\n'

    }
    interfaceJson.inputs.forEach((input, index) => {
      const typescriptType = interfaceJsonTypeToTypeScriptType.get(input.type)
      const end = index === interfaceJson.inputs.length - 1 && !haveParameters ? `\n` : `,\n`
      functionCall += `  ${camelCase(input.name)}: ${typescriptType}${end}`
    })
    if (haveParameters) {
      let requiredOptions = ""
      interfaceJson.parameters.forEach((parameter) => {
        if (parameter.required) {
          if (parameter.itemsExpectedMax > 1) {
            requiredOptions += ` ${camelCase(parameter.name)}: [`
            if (parameter.type === "FLOAT" || parameter.type === "INT") {
              for(let ii = 0; ii < parameter.itemsExpectedMin; ii++) {
                requiredOptions += `${parameter.default}, `
              }
            }
            requiredOptions += `],`
          } else {
            if (parameter.type === "FLOAT" || parameter.type === "INT") {
              requiredOptions += ` ${camelCase(parameter.name)}: ${parameter.default},`
            }
          }

        }
      })
      if (requiredOptions.length > 0) {
        requiredOptions += " "
      }
      functionCall += `  options: ${modulePascalCase}Options = {${requiredOptions}}\n) : Promise<${modulePascalCase}${nodeTextCamel}Result>`

    } else {
      functionCall += `\n) : Promise<${modulePascalCase}${nodeTextCamel}Result>`
    }
    readmeFunction += `*${interfaceJson.description}*\n\n`
    readmeFunction += `\`\`\`ts\n${functionCall}\n\`\`\`\n\n`
    readmeFunction += markdownTable(readmeParametersTable, { align: ['c', 'c', 'l'] }) + '\n'
    functionContent += functionCall
    functionContent += ' {\n\n'

    functionContent += `  const desiredOutputs: Array<PipelineOutput> = [\n`
    interfaceJson.outputs.forEach((output) => {
      if (interfaceJsonTypeToInterfaceType.has(output.type)) {
        const interfaceType = interfaceJsonTypeToInterfaceType.get(output.type)
        functionContent += `    { type: InterfaceTypes.${interfaceType} },\n`
      }
    })
    functionContent += `  ]\n`
    functionContent += `  const inputs: Array<PipelineInput> = [\n`
    interfaceJson.inputs.forEach((input, index) => {
      if (interfaceJsonTypeToInterfaceType.has(input.type)) {
        const interfaceType = interfaceJsonTypeToInterfaceType.get(input.type)
        const camel = camelCase(input.name)
        let data = camel
        if(interfaceType.includes('Stream')) {
          data = `{ data: ${camel} } `
        }
        functionContent += `    { type: InterfaceTypes.${interfaceType}, data: ${data} },\n`
      }
    })
    functionContent += `  ]\n\n`

    let inputCount = 0
    functionContent += "  const args = []\n"
    functionContent += "  // Inputs\n"
    interfaceJson.inputs.forEach((input) => {
      const camel = camelCase(input.name)
      if (interfaceJsonTypeToInterfaceType.has(input.type)) {
        const interfaceType = interfaceJsonTypeToInterfaceType.get(input.type)
        const name = interfaceType.includes('File') ?  `${camel}.path` : `'${inputCount.toString()}'`
        functionContent += `  args.push(${name})\n`
        inputCount++
      } else {
        functionContent += `  args.push(${camel}.toString())\n`
      }
    })

    let outputCount = 0
    functionContent += "  // Outputs\n"
    interfaceJson.outputs.forEach((output) => {
      const camel = camelCase(output.name)
      if (interfaceJsonTypeToInterfaceType.has(output.type)) {
        const interfaceType = interfaceJsonTypeToInterfaceType.get(output.type)
        const name = interfaceType.includes('File') ?  `${camel}.path` : `'${outputCount.toString()}'`
        functionContent += `  args.push(${name})\n`
        outputCount++
      } else {
        functionContent += `  args.push(${camel}.toString())\n`
      }
    })

    functionContent += "  // Options\n"
    functionContent += "  args.push('--memory-io')\n"
    interfaceJson.parameters.forEach((parameter) => {
      if (parameter.name === 'memory-io' || parameter.name === 'version') {
        // Internal
        return
      }
      const camel = camelCase(parameter.name)
      functionContent += `  if (typeof options.${camel} !== "undefined") {\n`
      if (parameter.type === "BOOL") {
        functionContent += `    args.push('--${parameter.name}')\n`
      } else if (parameter.itemsExpectedMax > 1) {
        functionContent += `    if(options.${camel}.length < ${parameter.itemsExpectedMin}) {\n`
        functionContent += `      throw new Error('"${parameter.name}" option must have a length > ${parameter.itemsExpectedMin}')\n`
        functionContent += `    }\n`
        functionContent += `    args.push('--${parameter.name}')\n`
        functionContent += `    options.${camel}.forEach((value) => {\n`
        if (interfaceJsonTypeToInterfaceType.has(parameter.type)) {
          const interfaceType = interfaceJsonTypeToInterfaceType.get(parameter.type)
          if (interfaceType.includes('File')) {
            // for Files
            functionContent += `      inputs.push({ type: InterfaceTypes.${interfaceType}, data: value as ${interfaceType} })\n`
            functionContent += `      args.push(value.path)\n`
          } else if (interfaceType.includes('Stream')) {
            // for Streams
            functionContent += `      const inputCountString = inputs.length.toString()\n`
            functionContent += `      inputs.push({ type: InterfaceTypes.${interfaceType}, data: { data: value } })\n`
            functionContent += `      args.push(inputCountString)\n`
          } else {
            // Image, Mesh, PolyData, JsonObject
            functionContent += `      const inputCountString = inputs.length.toString()\n`
            functionContent += `      inputs.push({ type: InterfaceTypes.${interfaceType}, data: value as ${interfaceType}})\n`
            functionContent += `      args.push(inputCountString)\n`
          }
        } else {
          functionContent += `      args.push(value.toString())\n`
        }
        functionContent += `    })\n`
      } else {
        if (interfaceJsonTypeToInterfaceType.has(parameter.type)) {
          const interfaceType = interfaceJsonTypeToInterfaceType.get(parameter.type)
          if (interfaceType.includes('File')) {
            // for Files
            functionContent += `    inputs.push({ type: InterfaceTypes.${interfaceType}, data: options.${camel} as ${interfaceType} })\n`
            functionContent += `    args.push('--${parameter.name}', options.${camel}.path)\n`
          } else if (interfaceType.includes('Stream')) {
            // for Streams
            functionContent += `    const inputCountString = inputs.length.toString()\n`
            functionContent += `    inputs.push({ type: InterfaceTypes.${interfaceType}, data: { data: options.${camel} } })\n`
            functionContent += `    args.push('--${parameter.name}', inputCountString)\n`
          } else {
            // Image, Mesh, PolyData, JsonObject
            functionContent += `    const inputCountString = inputs.length.toString()\n`
            functionContent += `    inputs.push({ type: InterfaceTypes.${interfaceType}, data: options.${camel} as ${interfaceType} })\n`
            functionContent += `    args.push('--${parameter.name}', inputCountString)\n`
          }
        } else {
          functionContent += `    args.push('--${parameter.name}', options.${camel}.toString())\n`
        }
      }
      functionContent += `  }\n`
    })

    const outputsVar = interfaceJson.outputs.length ? '    outputs\n' : ''
    if (forNode) {
      functionContent += `\n  const pipelinePath = path.join(path.dirname(import.meta.url.substring(7)), '..', 'pipelines', '${moduleKebabCase}')\n\n`
      functionContent += `  const {\n    returnValue,\n    stderr,\n${outputsVar}  } = await runPipelineNode(pipelinePath, args, desiredOutputs, inputs)\n`
    } else {
      functionContent += `\n  const pipelinePath = '${moduleKebabCase}'\n\n`
      functionContent += `  const {\n    webWorker: usedWebWorker,\n    returnValue,\n    stderr,\n${outputsVar}  } = await runPipeline(webWorker, pipelinePath, args, desiredOutputs, inputs, { pipelineBaseUrl: getPipelinesBaseUrl(), pipelineWorkerUrl: getPipelineWorkerUrl() })\n`
    }

    functionContent += '  if (returnValue !== 0) {\n    throw new Error(stderr)\n  }\n\n'

    functionContent += '  const result = {\n'
    if (!forNode) {
      functionContent += '    webWorker: usedWebWorker as Worker,\n'
    }
    interfaceJson.outputs.forEach((output, index) => {
      const camel = camelCase(output.name)
      const interfaceType = interfaceJsonTypeToInterfaceType.get(output.type)
      if (interfaceType.includes('Text') || interfaceType.includes('Binary') || interfaceType.includes('JsonObject')) {
        functionContent += `    ${camel}: (outputs[${index.toString()}].data as ${interfaceType}).data,\n`
      } else {
        functionContent += `    ${camel}: outputs[${index.toString()}].data as ${interfaceType},\n`
      }
    })
    functionContent += '  }\n'
    functionContent += '  return result\n'

    functionContent += `}\n\nexport default ${moduleCamelCase}${nodeTextCamel}\n`
    fs.writeFileSync(path.join(srcOutputDir, `${moduleKebabCase}${nodeTextKebab}.ts`), functionContent)
    indexContent += `import ${moduleCamelCase}${nodeTextCamel} from './${moduleKebabCase}${nodeTextKebab}.js'\n`
    indexContent += `export { ${moduleCamelCase}${nodeTextCamel} }\n`

    readmePipelines += readmeFunction
    readmePipelines += readmeOptions
    readmePipelines += readmeResult
  })

  readmeInterface += `  setPipelinesBaseUrl,
  getPipelinesBaseUrl,
  setPipelineWorkerUrl,
  getPipelineWorkerUrl,
`
  readmeInterface += `} from "${packageName}"\n\`\`\`\n`
  readmeInterface += readmePipelines

  const pipelinesBaseUrlPath = path.join(outputDir, 'src', 'pipelines-base-url.ts')
  if (!fs.existsSync(pipelinesBaseUrlPath)) {
    fs.copyFileSync(bindgenResource('pipelines-base-url.ts'), pipelinesBaseUrlPath)
    let pipelinesBaseUrlPathContent = fs.readFileSync(bindgenResource('pipelines-base-url.ts'), { encoding: 'utf8', flag: 'r' })
    pipelinesBaseUrlPathContent = pipelinesBaseUrlPathContent.replaceAll('<bindgenPackageName>', packageName)
    fs.writeFileSync(pipelinesBaseUrlPath, pipelinesBaseUrlPathContent)
  }
  const pipelineWorkerUrlPath = path.join(outputDir, 'src', 'pipeline-worker-url.ts')
  if (!fs.existsSync(pipelineWorkerUrlPath)) {
    let pipelineWorkerUrlPathContent = fs.readFileSync(bindgenResource('pipeline-worker-url.ts'), { encoding: 'utf8', flag: 'r' })
    pipelineWorkerUrlPathContent = pipelineWorkerUrlPathContent.replaceAll('<bindgenPackageName>', packageName)
    fs.writeFileSync(pipelineWorkerUrlPath, pipelineWorkerUrlPathContent)
  }

  const itkConfigPath = path.join(outputDir, 'src', 'itkConfig.js')
  if (!fs.existsSync(itkConfigPath)) {
    fs.copyFileSync(bindgenResource('itkConfig.js'), itkConfigPath)
  }

  fs.writeFileSync(path.join(srcOutputDir, `index${nodeTextKebab}.ts`), indexContent)

  return readmeInterface
}

function bindgen (outputDir, buildDir, filteredWasmBinaries, options) {
  let readme = ''
  const packageName = options.packageName
  readme += `# ${packageName}\n`
  readme += `\n[![npm version](https://badge.fury.io/js/${packageName.replace('/', '%2F')}.svg)](https://www.npmjs.com/package/${packageName})\n`
  readme += `\n> ${options.packageDescription}\n`
  readme += `\n## Installation\n
\`\`\`sh
npm install ${packageName}
\`\`\`
`

  let readmeUsage = '\n## Usage\n'
  let readmeBrowserInterface = '\n### Browser interface\n\nImport:\n\n```js\nimport {\n'
  let readmeNodeInterface = '\n### Node interface\n\nImport:\n\n```js\nimport {\n'

  readmeBrowserInterface += typescriptBindings(outputDir, buildDir, filteredWasmBinaries, options, false)
  readmeBrowserInterface += `
#### setPipelinesBaseUrl

*Set base URL for WebAssembly assets when vendored.*

\`\`\`ts
function setPipelinesBaseUrl(
  baseUrl: string | URL
) : void
\`\`\`

#### getPipelinesBaseUrl

*Get base URL for WebAssembly assets when vendored.*

\`\`\`ts
function getPipelinesBaseUrl() : string | URL
\`\`\`

#### setPipelineWorkerUrl

*Set base URL for the itk-wasm pipeline worker script when vendored.*

\`\`\`ts
function setPipelineWorkerUrl(
  baseUrl: string | URL
) : void
\`\`\`

#### getPipelineWorkerUrl

*Get base URL for the itk-wasm pipeline worker script when vendored.*

\`\`\`ts
function getPipelineWorkerUrl() : string | URL
\`\`\`
`
  readmeNodeInterface += typescriptBindings(outputDir, buildDir, filteredWasmBinaries, options, true)
  readme += readmeUsage
  readme += readmeBrowserInterface
  readme += readmeNodeInterface

  const readmePath = path.join(outputDir, 'README.md')
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, readme)
  }
}

export default bindgen
