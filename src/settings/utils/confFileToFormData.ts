import type { ConfFile, NewForm, SolidityObj, SpecObj } from '../types'

const newForm: NewForm = {
  solidyObj: {
    mainFile: '',
    mainContract: '',
    linking: [],
    specifiMethod: '',
    compiler: {
      exe: '',
      ver: '',
    },
    solidityArgument: '',
    solidityPackageDefaultPath: '',
    solidityPackageDir: [],
  },
  specObj: {
    specFile: '',
    rules: '',
    duration: '',
    inherit: '',
    optimisticLoop: false,
    loopUnroll: '',
    properties: [],
    runOnStg: false,
    branchName: '',
    localTypeChecking: false,
    shortOutput: false,
    multiAssert: false,
  },
  verificatoinMessage: '',
}

const stableFields = [
  'contracts',
  'verify',
  'solc',
  'link',
  'staging',
  'cache',
  'msg',
  'multi_assert_check',
  'packages',
  'rule',
  'solc_args',
  'smt_timeout',
  'loop_iter',
  'method',
  'short_output',
  'disableLocalTypeChecking',
  'optimistic_loop',
  'packages_path',
  'solc_map',
]

function getAdditionalSettings(confFile: ConfFile) {
  const copy = { ...confFile }

  stableFields.forEach(field => {
    delete copy[field]
  })

  return copy
}

/**
 * convert solc data from conf file to form
 * @param solc string path to solidity compiler executable
 * @param solidityObj solidity object
 */
function processCompiler(solc: string, solidityObj: SolidityObj) {
  if (solc.includes('/')) {
    const index = solc.lastIndexOf('/')
    solidityObj.compiler.exe = solc.slice(0, index)
    solidityObj.compiler.ver = solc.slice(index + 1, solc.length)
  } else {
    solidityObj.compiler.ver = solc
  }
}

/**
 * convert packages data from conf file to form
 * @param packages packages in conf file format
 * @param solidityObj solidity object
 */
function processPackages(packages: unknown, solidityObj: SolidityObj) {
  // todo: make sure packages always recieved with the same type
  let jsonPackages = {}
  if (typeof packages === 'string') {
    jsonPackages = JSON.parse(packages.toString())
  } else if (typeof packages === 'object') {
    jsonPackages = packages
  }
  Object.entries(jsonPackages).forEach(key => {
    const packArray = key.toString().split(',')
    const tempPackage = {
      packageName: packArray[0].toString(),
      path: packArray[1].toString(),
    }
    solidityObj.solidityPackageDir.push(tempPackage)
  })
}

function processLink(linkArr: string[], solidityObj: SolidityObj) {
  linkArr.forEach(link => {
    const linkArr = link.split(/[:=]/)
    if (linkArr.length === 3 && linkArr[0] === solidityObj.mainContract) {
      solidityObj.linking.push({
        variable: linkArr[1],
        contractName: linkArr[2],
      })
    }
  })
}

/**
 * convert conf file attributes to solidity object attributes (form)
 * @param confFile conf file
 * @param solidityObj soility object
 */
function processSolidityAttributes(
  confFile: ConfFile,
  solidityObj: SolidityObj,
) {
  if (confFile.solc) {
    processCompiler(confFile.solc, solidityObj)
  }

  if (confFile.link && confFile.link.length > 0) {
    processLink(confFile.link, solidityObj)
  }

  if (confFile.packages) {
    processPackages(confFile.packages, solidityObj)
  }

  if (confFile.solc_args) {
    solidityObj.solidityArgument = confFile.solc_args.toString()
  }

  if (confFile.method) {
    solidityObj.specifiMethod = confFile.method.toString()
  }
}

/**
 * convert conf file data to spec object
 * @param confFile conf file
 * @param specObj spec object
 */
function processSpecAttributes(confFile: ConfFile, specObj: SpecObj) {
  if (confFile.multi_assert_check) {
    specObj.multiAssert = true
  }

  if (confFile.optimistic_loop) {
    specObj.optimisticLoop = true
  }

  if (confFile.rule) {
    specObj.rules = (confFile.rule as string).replace(' ', ',')
  }

  if (confFile.smt_timeout) {
    specObj.duration = confFile.smt_timeout.toString()
  }

  if (confFile.loop_iter) {
    specObj.loopUnroll = confFile.loop_iter.toString()
  }

  if (confFile.short_output !== undefined) {
    specObj.shortOutput = confFile.short_output as boolean
  }

  if (confFile.disableLocalTypeChecking !== undefined) {
    specObj.localTypeChecking = !confFile.disableLocalTypeChecking as boolean
  }

  if (confFile.staging) {
    specObj.runOnStg = true
    specObj.branchName = confFile.staging as string
  }

  const additionalSettings = getAdditionalSettings(confFile)
  if (Object.keys(additionalSettings)?.length > 0) {
    specObj.properties = Object.keys(additionalSettings).map(key => ({
      name: key as string,
      value: additionalSettings[key].toString(),
    }))
  }
}

export function confFileToFormData(confFile: ConfFile): NewForm {
  const form = newForm as NewForm

  if (Array.isArray(confFile.contracts) && confFile.contracts.length > 0) {
    form.solidyObj.mainFile = confFile.contracts[0] as string

    if (form.solidyObj.mainFile.includes(':')) {
      form.solidyObj.mainFile = form.solidyObj.mainFile.split(':')[0]
      form.solidyObj.mainContract = confFile.contracts[0].split(':')[1]
    }
  }

  if (Array.isArray(confFile.verify) && confFile.verify.length === 1) {
    const verifyStr = confFile.verify[0] as string
    const [mainContractName, specFile] = verifyStr.split(':')

    if (mainContractName) {
      form.solidyObj.mainContract = mainContractName
    }
    if (specFile) {
      form.specObj.specFile = specFile
    }
  }

  processSolidityAttributes(confFile, form.solidyObj)
  processSpecAttributes(confFile, form.specObj)

  if (confFile.msg) {
    form.verificatoinMessage = confFile.msg
  }

  // additional contracts
  if (confFile.contracts?.length > 1) {
    processAdditionalContracts(confFile, form)
  }
  return form
}

/**
 * fill additional contracts values from the conf file
 * @param confFile to get values from (solidity file, contract name, compiler, link)
 * @param form to fill additional contract data
 */
function processAdditionalContracts(confFile: ConfFile, form: NewForm): void {
  const tempFormArr: SolidityObj[] = []
  confFile.contracts.forEach(contractStr => {
    const solArr = contractStr.split(':') || []
    if (solArr.length === 2 && solArr[1] !== form.solidyObj.mainContract) {
      // create contract
      const tempForm: SolidityObj = {
        mainFile: '',
        mainContract: '',
        linking: [],
        specifiMethod: '',
        compiler: {
          exe: '',
          ver: '',
        },
        solidityArgument: '',
        solidityPackageDefaultPath: '',
        solidityPackageDir: [],
      }
      tempForm.mainFile = solArr[0] || ''
      tempForm.mainContract = solArr[1] || ''

      // link
      if (confFile.link && confFile.link.length > 0) {
        processLink(confFile.link, tempForm)
      }

      // solc map:
      if (confFile.solc_map) {
        Object.entries(confFile.solc_map).forEach(([key, value]) => {
          if (key === tempForm.mainContract) {
            processCompiler(value, tempForm)
          } else if (key === form.solidyObj.mainContract) {
            processCompiler(value, form.solidyObj)
          }
        })
      }
      tempFormArr.push(tempForm)
    }
  })
  form.solidityAdditionalContracts = tempFormArr
}
