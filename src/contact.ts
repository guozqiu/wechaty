/**
 *
 * wechaty: Wechat for Bot. and for human who talk to bot/robot
 *
 * Licenst: ISC
 * https://github.com/zixia/wechaty
 *
 */
import {
    Config
  , Sayable
}               from './config'
import Message  from './message'
import UtilLib  from './util-lib'
import Wechaty  from './wechaty'
import log      from './brolog-env'

type ContactObj = {
  address:    string
  city:       string
  id:         string
  name:       string
  province:   string
  remark:     string
  sex:        string
  signature:  string
  star:       boolean
  stranger:   boolean
  uin:        string
  weixin:     string
}

export type ContactRawObj = {
  Alias:        string
  City:         string
  NickName:     string
  Province:     string
  RemarkName:   string
  Sex:          string
  Signature:    string
  StarFriend:   string
  Uin:          string
  UserName:     string

  stranger:     string // assign by injectio.js
}

export type ContactQueryFilter = {
  name: string | RegExp
}

export class Contact implements Sayable {
  private static pool = new Map<string, Contact>()

  private obj: ContactObj
  private rawObj: ContactRawObj

  constructor(public readonly id: string) {
    log.silly('Contact', `constructor(${id})`)

    if (typeof id !== 'string') {
      throw new Error('id must be string. found: ' + typeof id)
    }
  }

  public toString()  { return this.id }
  public toStringEx() { return `Contact(${this.obj && this.obj.name}[${this.id}])` }

  private parse(rawObj: ContactRawObj): ContactObj {
    return !rawObj ? null : {
      id:           rawObj.UserName
      , uin:        rawObj.Uin    // stable id: 4763975 || getCookie("wxuin")
      , weixin:     rawObj.Alias  // Wechat ID
      , name:       rawObj.NickName
      , remark:     rawObj.RemarkName
      , sex:        rawObj.Sex
      , province:   rawObj.Province
      , city:       rawObj.City
      , signature:  rawObj.Signature

      , address:    rawObj.Alias // XXX: need a stable address for user

      , star:       !!rawObj.StarFriend
      , stranger:   !!rawObj.stranger // assign by injectio.js
    }
  }

  public name()      { return UtilLib.plainText(this.obj && this.obj.name) }
  public remark()    { return this.obj && this.obj.remark }
  public stranger()  { return this.obj && this.obj.stranger }
  public star()      { return this.obj && this.obj.star }

  public get(prop)   { return this.obj && this.obj[prop] }

  public isReady(): boolean {
    return !!(this.obj && this.obj.id)
  }

  public async ready(contactGetter?: (id: string) => Promise<ContactRawObj>): Promise<this> {
    log.silly('Contact', 'ready(' + (contactGetter ? typeof contactGetter : '') + ')')
    if (!this.id) {
      log.warn('Contact', 'ready() call on an un-inited contact')
      return Promise.resolve(this)
    }

    if (this.isReady()) { // already ready
      return Promise.resolve(this)
    }

    if (!contactGetter) {
      if (!Config.puppetInstance()) { throw new Error('Config.puppetInstance() is not found by Contact') }

      log.silly('Contact', 'get contact via ' + Config.puppetInstance().constructor.name)
      contactGetter = Config.puppetInstance()
                            .getContact.bind(Config.puppetInstance())
    }

    // return contactGetter(this.id)
    //         .then(data => {
    try {
      const rawObj = await contactGetter(this.id)
      log.silly('Contact', `contactGetter(${this.id}) resolved`)
      this.rawObj = rawObj
      this.obj    = this.parse(rawObj)
      return this
    // }).catch(e => {
    } catch (e) {
      log.error('Contact', `contactGetter(${this.id}) exception: %s`, e.message)
      throw e
    }
  }

  public dumpRaw() {
    console.error('======= dump raw contact =======')
    Object.keys(this.rawObj).forEach(k => console.error(`${k}: ${this.rawObj[k]}`))
  }
  public dump()    {
    console.error('======= dump contact =======')
    Object.keys(this.obj).forEach(k => console.error(`${k}: ${this.obj[k]}`))
  }

  public static findAll(query: ContactQueryFilter): Promise<Contact[]> {
    log.silly('Cotnact', 'findAll({ name: %s })', query.name)

    const name = query.name

    if (!name) {
      throw new Error('name not found')
    }

    /**
     * must be string because we need inject variable value
     * into code as variable name
     */
    let filterFunction: string

    if (name instanceof RegExp) {
      filterFunction = `c => ${name.toString()}.test(c)`
    } else if (typeof name === 'string') {
      filterFunction = `c => c === '${name}'`
    } else {
      throw new Error('unsupport name type')
    }

    return Config.puppetInstance()
                  .contactFind(filterFunction)
                  .catch(e => {
                    log.error('Contact', 'findAll() rejected: %s', e.message)
                    return [] // fail safe
                  })
  }

  public static find(query: ContactQueryFilter): Promise<Contact> {
    log.verbose('Contact', 'find(%s)', query.name)

    return Contact.findAll(query)
                  .then(contactList => {
                    if (contactList && contactList.length > 0) {
                      return contactList[0]
                    }
                    return null
                  })
                  .catch(e => {
                    log.error('Contact', 'find() rejected: %s', e.message)
                    return null // fail safe
                  })
  }

  public static load(id: string): Contact {
    if (!id || typeof id !== 'string') {
      return null
    }

    if (!(id in Contact.pool)) {
      Contact.pool[id] = new Contact(id)
    }
    return Contact.pool[id]
  }

  public say(content: string): Promise<any> {
    log.verbose('Contact', 'say(%s)', content)

    const wechaty = Wechaty.instance()
    const user = wechaty.user()

    const m = new Message()
    m.from(user)
    m.to(this)
    m.content(content)

    log.silly('Contact', 'say() from: %s to: %s content: %s', user.name(), this.name(), content)

    return wechaty.send(m)
  }

}

// Contact.search = function(options) {
//   if (options.name) {
//     const regex = new RegExp(options.name)
//     return Object.keys(Contact.pool)
//     .filter(k => regex.test(Contact.pool[k].name()))
//     .map(k => Contact.pool[k])
//   }

//   return []
// }

export default Contact