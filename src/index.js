import * as React from 'react'
import * as ReactDOM from 'react-dom'

import socketIOClient from "socket.io-client";

import * as Material from "@material-ui/core"
import * as Icons from "@material-ui/icons"
import SearchBar from "material-ui-search-bar"

import appLogo from "./resources/logo.jpg"
import sir5logo from "./resources/5sirlogo.jpg"

import {ViewState} from "@devexpress/dx-react-scheduler"
import {
  Scheduler,
  MonthView,
  Appointments,
  Toolbar,
  DateNavigator
} from "@devexpress/dx-react-scheduler-material-ui"

import CalendarTodayIcon from "@material-ui/icons/CalendarToday"
import ListIcon from "@material-ui/icons/List"
import AddIcon from "@material-ui/icons/Add"

import ClientSecret from "./CLIENT_SECRET.js"

const VERSION_NUMBER = "0.1.20b"
console.log(VERSION_NUMBER)

const ranker = require("./searchRanker.js")

var serverURL = "https://ancient-refuge-34590.herokuapp.com/"

var setTabs
var additionalTabs = []
const RESERVED_TABS = 1
var tabID = RESERVED_TABS
const addTab = (tab) => {
  additionalTabs = [...additionalTabs]
  additionalTabs.push(tab)
  setTabs(additionalTabs)
}
const removeTab = (id) => {
  additionalTabs = [...additionalTabs].filter(x => x.params[0] !== id)
  detailPersistentStore[id] = undefined
  setTabs(additionalTabs)
}

var socket
var RECOMMEND_PIN = ""

const ScrollWrapper = ({childContext, mykey, children}) => {
  const currKey = React.useRef(mykey)
  if (currKey.current !== mykey && currKey.current !== null) {
    childContext.current[currKey.current] = window.scrollY
    currKey.current = null
  }
  React.useLayoutEffect(() => {
    currKey.current = mykey
    if (childContext.current[mykey] === undefined) {
      childContext.current[mykey] = 0
    }
    window.scrollTo(window.scrollX, childContext.current[mykey])
  }, [mykey, currKey])
  return children
}

const App = () => {
  
  var [tabs, mySetTabs] = React.useState([])
  setTabs = mySetTabs
  React.useEffect(() => {
    socket = socketIOClient(serverURL, {secure: true});
    socket.on("sendIndents", (indents, writeToken) => {
      if (writeToken !== undefined) {
        if (writeToken < ackWriteToken) {
          return
        }
        ackWriteToken = writeToken
        if (pendingWrites[writeToken] !== undefined) {
          pendingWrites[writeToken]()
        }
      }
      dataStore = [...indents].reverse()
      notifyNewData()
    })
    socket.on("sendNotifications", (notifications) => {
      notificationsStore = [...notifications].reverse()
      notifyNewN()
    })
    socket.on("alert", (message) => {
      alert(message)
    })
    socket.on("requestauth", (message) => {
      RECOMMEND_PIN = prompt(message)
      if (RECOMMEND_PIN === null) {
        return
      }
      if (PREVIOUS_EDIT_PARAMS !== null) {
        const saved = PREVIOUS_EDIT_PARAMS
        PREVIOUS_EDIT_PARAMS = null
        editData(saved.index, saved.newData)
      }
    })
    socket.emit("requestIndents", "")
    socket.emit("requestNotifications", "")
    return () => {
      socket.disconnect()
    }
  }, [])
  const [selTab, setSelTab] = React.useState(0)
  const appbarRef = React.useRef(null)
  const heightListeners = React.useRef([])
  const currentHeight = React.useRef(0)

  React.useEffect(() => {
    if (appbarRef.current) {
      currentHeight.current = appbarRef.current.offsetHeight
      for (const listener of heightListeners.current) {
        listener(appbarRef.current.offsetHeight)
      }
    }
  }, [appbarRef])

  const newIndentPersistentStore = React.useRef({})
  const childScrollContext = React.useRef({})

  return (
    <div>
      <Tabs childWrapper={ScrollWrapper} childContext={childScrollContext} selTab={selTab} setSelTab={setSelTab} appbarRef={appbarRef}>
        {[(<div label="view indents" key="defaultTab1" mykey="defaultTab1">
          <TransportView setSelTab={setSelTab} heightProvider={[currentHeight, heightListeners]} />
        </div>),
        (<div label="new indent" key="defaultTab2" mykey="defaultTab2">
          <NewIndentView id={0}/>
        </div>),
        (<div label="notifications" key="defaultTab3" mykey="defaultTab3">
          <NotificationsPanel setSelTab={setSelTab}/>
        </div>), ...tabs.map(({type, params: v}, i) => type === "detail" ? (<DetailGenerator setSelTab={setSelTab} mykey={v[0]} label={readDataStore(v[1]).name} removable="true" removeCallback={(index, length) => {
          removeTab(v[0])
          const currSelTab = Math.min(selTab, length-1)
          if (currSelTab > index) {
            setSelTab(currSelTab-1)
          }
        }} details={v} key={v[0]} heightProvider={[currentHeight, heightListeners]} />)
        : type === "newindent" ? (<NewIndentView cloneID={v[1]} mykey={v[0]} label="new indent" removable="true" removeCallback={(index, length) => {
          removeTab(v[0])
          const currSelTab = Math.min(selTab, length-1)
          if (currSelTab > index) {
            setSelTab(currSelTab-1)
          }
        }} id={v[0]} key={v[0]}/>) : (<div></div>))]}
      </Tabs>
      <div style={{height: "12px"}}/>
      <img src={sir5logo} width="192px"/>
    </div>
  );
}

const DevPanel = () => {
  const [myServerURL, setServerURL] = React.useState(serverURL)
  const [response, setResponse] = React.useState("");
  const myListener = data => {
    setResponse(data)
  }

  React.useEffect(() => {
    socket.on("FromAPI", myListener);
    return () => {
      socket.off("FromAPI", myListener)
    }
  }, []);

  return (<div>
    <div>Server URL</div><textarea value={myServerURL} onChange={(event) => {
      serverURL = event.target.value
      setServerURL(serverURL)
    }}/>
    <div>It's {response}</div>
  </div>)
}

const NotificationsPanel = ({setSelTab}) => {
  var myData = readNotifications()
  const [data, setData] = React.useState(myData)
  React.useEffect(() => {
    const callbackID = registerNotify(setData)
    return () => deregisterNotify(callbackID)
  }, [])
  var newData = []
  const encountered = {}
  for (var i = 0; i < myData.length; i++) {
    if (encountered[myData[i].internalUID] === true) {
      newData.push({...myData[i], latest: false})
    }
    else {
      newData.push({...myData[i], latest: true})
    }
    encountered[myData[i].internalUID] = true
  }
  return (
    <div>
      <div style={{height: "12px"}}/>
      <Material.Paper square>
        <ListFactory data={newData} generator={(x, index) => notificationItemGenerator(x, x.internalUID, ""+x.internalUID+index, setSelTab)} style={TransportViewStyle}/>
      </Material.Paper>
    </div>
  )
}

const detailPersistentStore = {}

const DetailGenerator = ({setSelTab, details, heightProvider}) => {
  const [id, index] = details
  if (detailPersistentStore[id] === undefined) {
    detailPersistentStore[id] = readDataStore(index)
  }
  const [data, setData] = React.useState(detailPersistentStore[id])
  return (
  <div>
    <div style={{height:"12px"}}/>
    <Material.Paper square>
      <ListFactory header={(<MyStickyHeader heightProvider={heightProvider}>{detailFields.map((x, index) => (<Material.TableCell key={index}>{x.friendlyName}</Material.TableCell>))}</MyStickyHeader>)} data={[data]} generator={x => detailItemGenerator(x, x.internalUID)} style={TransportViewStyle}/>
    </Material.Paper>
    <div style={{height:"12px"}}/>
    <Material.Button variant="outlined" onClick={() => {
      addNewTab(data.internalUID)
      setSelTab(Infinity)
    }}>Copy</Material.Button>
    <div style={{height:"12px"}}/>
    <div>
      <div style={{display:"inline", verticalAlign:"middle"}}>
        <Material.Select variant="outlined" native value={data.status} onChange={(event) => {
          detailPersistentStore[id] = {...detailPersistentStore[id], status: event.target.value}
          setData(detailPersistentStore[id])
        }}>
        {statuses.map((val, index) => (<option key={index} value={val}>{val}</option>))}
        </Material.Select>
      </div>
      <div style={{display:"inline-block", width:"1px"}}/>
      <div style={{display:"inline", verticalAlign:"middle"}}>
        <Material.Button variant="outlined" onClick={() => {editData(index, detailPersistentStore[id])}}>Save</Material.Button>
      </div>
    </div>
  </div>
  )
}

var PREVIOUS_EDIT_PARAMS = null

const editData = async (index, newData) => {
  PREVIOUS_EDIT_PARAMS = {index, newData}
  const packet = {data: newData, pin: RECOMMEND_PIN}
  const refresh = await writeDataStore(index, packet)
  if (refresh) {
    notifyNewData()
  }
}

const readDataStore = (internalUID) => {
  const result = dataStore.filter(x => x.internalUID === internalUID)
  if (result.length === 0) {
    return undefined
  }
  else {
    return result[0]
  }
}

var ackWriteToken = 0
var currWriteToken = 0
var pendingWrites = []

const writeDataStore = async (internalUID, write) => {
  currWriteToken++
  var resolve
  const myPromise = new Promise(v => resolve=v)
  pendingWrites[currWriteToken] = resolve
  socket.emit("writeDataStore", [internalUID, write, currWriteToken])
  await myPromise
  if (currWriteToken === ackWriteToken) {
    return true
  }
  else {
    return false
  }
}

const appendDataStore = async (write) => {
  currWriteToken++
  var resolve
  const myPromise = new Promise(v => resolve=v)
  pendingWrites[currWriteToken] = resolve
  socket.emit("appendDataStore", [write, currWriteToken])
  await myPromise
  if (currWriteToken === ackWriteToken) {
    return true
  }
  else {
    return false
  }
}

const readRange = () => {
  return dataStore
}

const newIndentValidator = (data, authenticated) => {
  const fmt = str => str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16)
  const sd = Math.min(new Date(fmt(data.startDateTime)))
  if (sd !== sd) {
    return ["FAILED", "Enter a valid start date"]
  }
  const ed = Math.min(new Date(fmt(data.endDateTime)))
  if (ed !== ed) {
    return ["FAILED", "Enter a valid end date"]
  }
  if (ed <= sd) {
    return ["FAILED", "End date must be after start date"]
  }
  const timeDelta = Math.min(sd||Infinity, ed||Infinity)-(new Date())
  if (timeDelta < 1296000000 && authenticated !== true) {
    return ["AUTHENTICATE", "Request is not 14 calendar days in advance. Speak to 5SIR S3 Branch for ad-hoc request."]
  }
  for (const field in data) {
    if (fieldAttributes[field].optional !== true && (typeof data[field] !== "string" || data[field].trim() === "")) {
      if (fieldToFriendly[field] !== undefined) {
        return ["FAILED", fieldToFriendly[field] + " cannot be empty"]
      }
      return ["FAILED", "Field cannot be empty"]
    }
  }
  return ["SUCCESS"]
}

const submitForm = async (data, validator, authenticated) => {
  if (typeof validator === "function") {
    const validated = validator(data, authenticated)
    if (validated[0] !== "SUCCESS") {
      return validated
    }
  }
  const refresh = await appendDataStore(data)
  if (refresh) {
    notifyNewData()
    return ["SUCCESS"]
  }
  return ["UNKNOWN"]
}

const FormFactory = ({prefill, fields, defaults, formPersistentStore, validator}) => {
  var fieldStates = []
  var myPersistentStore = formPersistentStore === undefined ? {} : formPersistentStore
  if (myPersistentStore.data === undefined) {
    myPersistentStore.data = fields.map(x => {
      if (typeof prefill === "object") {
        const prefilledField = prefill[x.name]
        if (prefilledField !== undefined) {
          const prefillConverter = prefillConverters[x.name]
          if (typeof prefillConverter === "function") {
            return prefillConverter(prefilledField)
          }
          return prefilledField
        }
      }
      return x.initialData
    })
  }
  const [states, setStates] = React.useState(myPersistentStore.data)
  var myStates = states
  for (var index = 0; index < fields.length; index++) {
    const i = index
    const field = fields[i]
    fieldStates.push([states[i], x => {
      myStates = [...myStates]
      myStates[i] = x
      myPersistentStore.data = myStates
      setStates(myStates)
    },field.initialData, field.name, field.friendlyName, field.fieldType, field.options])
  }
  const initializeFields = () => {
    const initializedFields = fields.map(x => x.initialData)
    myPersistentStore.data = initializedFields
    setStates(initializedFields)
  }
  const submit = async (authenticated) => {
    var constitutedObject = {}
    for (const {name, initialData} of defaults) {
      constitutedObject[name] = initialData
    }
    for (const [text, setText, initialData, fieldName, friendlyName, fieldType] of fieldStates) {
      const normalizer = normalizers[fieldType]
      constitutedObject[fieldName] = normalizer ? normalizer(text) : text
    }
    const [result, params] = await submitForm(constitutedObject, validator, authenticated)
    if (result === "SUCCESS") {
      alert("Indent submitted successfully!")
      initializeFields()
    }
    else if (result === "FAILED") {
      alert(params)
    }
    else if (result === "AUTHENTICATE") {
      const password = prompt(params)
      if (password === null || password === "") {
        return
      }
      else if (password === ClientSecret) {
        submit(true)
      }
      else {
        alert("Incorrect bypass code.")
      }
    }
  }
  return (
  <form noValidate>
  <div>
  {fieldStates.map(([text, setText, initialData, fieldName, friendlyName, fieldType, options], index) => {
    return (
      <div style={formItemStyle} key={index}>
      {fieldType === "datetime" ?
      (<Material.TextField
        id="datetime-local"
        fullWidth={true}
        label={friendlyName}
        type="datetime-local"
        variant="outlined"
        value={text}
        onChange={(event) => setText(event.target.value)}
        InputLabelProps={{
          shrink: true,
        }}
        style={{maxWidth: "1000px"}}
      />)
      :fieldType === "select" ? 
      (<Material.TextField 
      fullWidth={true}
      select
      label={friendlyName}
      variant="outlined"
      value={text}
      SelectProps={{
        native: true
      }}
      onChange={(event) => setText(event.target.value)}
      InputLabelProps={{
        shrink: true,
      }}
      style={{maxWidth: "1000px"}}
      >
      {options.map((val, index) => (<option key={index} value={val}>{val}</option>))}
      </Material.TextField>)
      :fieldType === "multi" ?
      (<Material.TextField
      fullWidth={true}
      multiline
      label={friendlyName}
      variant="outlined"
      value={text[0] ?? ""}
      onChange={(event) => setText([event.target.value])}
      InputLabelProps={{
        shrink: true
      }}
      style={{maxWidth: "1000px"}}/>)
      :(<Material.TextField fullWidth={true} multiline label={friendlyName} variant="outlined" value={text} onChange={(event) => setText(event.target.value)} InputLabelProps={{shrink: true,}} style={{maxWidth: "1000px"}}/>)
      }
      </div>
    )
  })}
  </div>
  <Material.Button variant="outlined" onClick={submit}>submit</Material.Button>
  </form>
  )
}

const normalizers = {
  "datetime": x => {
    try {
      if (x.length > 0) {
        return x.slice(8, 10) + "/" + x.slice(5, 7) + "/" + x.slice(0, 4) + " " + x.slice(11, 16)
      }
    }
    catch {
    }
    return x
  }
}

const formItemStyle = {
  display: "flex",
  justifyContent: "center",
  paddingLeft: "12px",
  paddingRight: "12px",
  paddingTop: "5px",
  paddingBottom: "7px"
}

const NewIndentView = ({id, cloneID}) => {
  if (detailPersistentStore[id] === undefined) {
    detailPersistentStore[id] = {}
  }
  const prefill = React.useMemo(() => cloneID !== undefined ? readDataStore(cloneID) : undefined, [cloneID, dataDefaults])
  return (<div style={TransportViewStyle}><div style={{height: "12px"}}/><FormFactory prefill={prefill} fields={formFields} defaults={dataDefaults} formPersistentStore={detailPersistentStore[id]} validator={newIndentValidator}/></div>)
}

const DEBOUNCE_PERIOD = 100

const transportPersistentStore = {}

const Appointment = (setSelTab) => ({data, children, ...restProps}) => {
  var backgroundColor = "gray"
  if (data.status === "Recommended") {
    backgroundColor = "green"
  }
  else {
    const timeDelta = Math.min(Math.min(new Date(data.startDate))||Infinity, Math.min(new Date(data.endDate))||Infinity)-(new Date())
    if (timeDelta < 1296000000) {
      backgroundColor = "red"
    }
    else if (timeDelta < 1555200000) {
      backgroundColor = "rgb(204, 204, 0)"
    }
  }
  return (<Appointments.Appointment
    {...restProps}
    data={data}
    onClick={obj => {
      addDetailTab(undefined, obj.data.internalUID)
      setSelTab(Infinity)
    }}
    style={{backgroundColor: backgroundColor}}
  >
    {children}
  </Appointments.Appointment>)
}

const TransportView = ({setSelTab, heightProvider}) => {
  if (transportPersistentStore.initialized !== true) {
    transportPersistentStore.initialized = true
    transportPersistentStore.data = ""
    transportPersistentStore.sort = null
    transportPersistentStore.up = true
    transportPersistentStore.view = "list"
    transportPersistentStore.selDate = (x => (x.setMinutes(x.getMinutes()-x.getTimezoneOffset()), x))(new Date()).toISOString().slice(0, 10)
  }
  const range = readRange()
  React.useEffect(() => {
    const callbackID = registerCallback(value => {
      myData.current = value
      myRanker.current = ranker.makeRanker(value)
      setData(myQuery.current !== "" ? myRanker.current(myQuery.current) : value)
    })
    return () => deregisterCallback(callbackID)
  }, [])
  const [search, setSearch] = React.useState(transportPersistentStore.data)
  const last = React.useRef(null)
  const myData = React.useRef(range)
  const vRanker = ranker.makeRanker(range)
  const myRanker = React.useRef(vRanker)
  const myQuery = React.useRef(transportPersistentStore.data)
  const [data, setData] = React.useState(transportPersistentStore.data !== "" ? vRanker(transportPersistentStore.data) : range)
  const onChange = value => {
    transportPersistentStore.data = value
    setSearch(value)
    transportPersistentStore.view = "list"
    setView("list")
    transportPersistentStore.sort = null
    setSort(null)
    transportPersistentStore.up = true
    setUp(true)
    if (last.current !== null) {
      clearTimeout(last.current)
      last.current = null
    }
    last.current = setTimeout(() => {
      myQuery.current = value
      setData(value !== "" ? myRanker.current(value) : myData.current)
      last.current = null
    }, DEBOUNCE_PERIOD)
  }
  const barRef = React.useRef(null)
  const [mySort, setSort] = React.useState(transportPersistentStore.sort)
  const [isUp, setUp] = React.useState(transportPersistentStore.up)
  const filteredData = React.useMemo(() => data.filter(x => x.status !== "Hidden"), [data])
  const sortedData = React.useMemo(() => mySort === null ? filteredData : filteredData.map((x, index) => [x, index]).sort(([dx, ix], [dy, iy]) => {
    const materializer = typeof sortMaterializers[mySort] === "function" ? sortMaterializers[mySort] : x => x
    const x = materializer(dx[mySort])
    const y = materializer(dy[mySort])
    if (typeof x === typeof y && x !== y) {
      if (typeof x === "string") {
        for (var i = 0; i < Math.min(x.length, y.length); i++) {
          const xc = x.charCodeAt(i)
          const yc = y.charCodeAt(i)
          if (xc !== yc) {
            return xc-yc
          }
        }
        return x.length - y.length
      }
      else if (typeof x === "number") {
        return x-y
      }
    }
    return ix-iy
  }).map(([x, ix]) => x)
  , [filteredData, mySort])
  const reversedData = React.useMemo(() => isUp === true ? sortedData : [...sortedData].reverse(), [sortedData, isUp])
  const sortOnClick = name => {
    transportPersistentStore.data = ""
    setSearch("")
    const set = name === mySort ? (isUp === false ? (transportPersistentStore.sort = null, setSort(null), true) : false) : (transportPersistentStore.sort = name, setSort(name), true)
    transportPersistentStore.up = set
    setUp(set)
  }
  const [view, setView] = React.useState(transportPersistentStore.view)
  const [selDate, setDate] = React.useState(transportPersistentStore.selDate)
  const myAppointment = React.useMemo(() => Appointment(setSelTab), [setSelTab])
  React.useEffect(() => {
    if (barRef.current === null) {
      return
    }
    barRef.current.addEventListener("keyup", e => {
      if (e.charCode === 13 || e.key === "Enter") {
        e.stopPropagation()
      }
    }, {capture: true})
  }, [barRef])
  return (
    <div>
      <div style={{height: "12px"}}/>
      <div style={{marginLeft: "12px", marginRight: "12px"}}>
        <div ref={barRef}>
          <SearchBar
            value={search}
            onChange={onChange}
            onCancelSearch={() => onChange("")}
            onRequestSearch={() => {
              if (view === "list") {
                transportPersistentStore.view = "calendar"
                setView("calendar")
              }
              else {
                transportPersistentStore.view = "list"
                setView("list")
              }
            }}
            style={{margin: "auto", maxWidth: "1000px"}}
            searchIcon={<AnimatedIcon icon={view}/>}
            />
        </div>
      </div>
      <div style={{height: "12px"}}/>
      <Material.Paper square>
        {view === "list" ? (<ListFactory header={(<MyStickyHeader heightProvider={heightProvider}>{displayFields.map((x, index) => (<Material.TableCell key={index}><Material.TableSortLabel active={mySort === x.name} direction={mySort === x.name && isUp === false ? "desc" : "asc"} onClick={() => sortOnClick(x.name)}>{x.friendlyName}</Material.TableSortLabel></Material.TableCell>))}</MyStickyHeader>)} data={reversedData} generator={x => transportItemGenerator(x, x.internalUID, setSelTab)} style={TransportViewStyle}/>)
        : (<Scheduler data={filteredData.map(x => {
          const fmt = str => str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16)
          return {
            startDate: fmt(x.startDateTime),
            endDate: fmt(x.endDateTime),
            title: x.name,
            internalUID: x.internalUID,
            status: x.status
          }
        })}>
          <ViewState defaultCurrentDate={selDate} onCurrentDateChange={date => {
            transportPersistentStore.selDate = date
            setDate(date)
          }}/>
          <MonthView/>
          <Appointments
            appointmentComponent={myAppointment}
          />
          <Toolbar/>
          <DateNavigator/>
        </Scheduler>)}
      </Material.Paper>
    </div>
  )
}

const ANIMATION_TIME = 0.075
const TRANSITION_STRING = `all ${ANIMATION_TIME}s linear`

const synchronousAnimationProvider = (ref, onAnimationCollapse) => {
  const processEnd = () => {
    if (ref.current.getBoundingClientRect().width === 0) {
      onAnimationCollapse()
    }
  }
  ref.current.addEventListener("transitionend", processEnd)
  ref.current.addEventListener("transitioncancel", processEnd)
  const requestChange = (change) => {
    if (change === "expand") {
      ref.current.classList.remove("collapsed")
      ref.current.classList.add("expanded")
    }
    else if (change === "collapse") {
      ref.current.classList.remove("expanded")
      ref.current.classList.add("collapsed")
      processEnd()
    }
  }
  return requestChange
}

const AnimatedIcon = ({icon}) => {
  const firstRender = React.useRef(true)
  const synchronousIcon = React.useRef(icon)
  const [displayedIcon, setIcon] = React.useState(icon)
  const iconRef = React.useRef(null)
  const currTarget = React.useRef(null)
  const request = React.useRef(null)
  React.useEffect(() => {
    request.current = synchronousAnimationProvider(iconRef, () => {
      if (currTarget.current !== null) {
        const icon = currTarget.current
        currTarget.current = null
        synchronousIcon.current = icon
        setIcon(icon)
        request.current("expand")
      }
    })
  }, [iconRef])
  React.useEffect(() => {
    if (firstRender.current === true) {
      firstRender.current = false
      return
    }
    if (synchronousIcon.current === icon) {
      currTarget.current = null
      request.current("expand")
      return
    }
    currTarget.current = icon
    request.current("collapse")
  }, [icon])
  return (<Material.Icon ref={iconRef} style={{transition: TRANSITION_STRING}}>{displayedIcon === "list" ? (<CalendarTodayIcon/>) : (<ListIcon/>)}</Material.Icon>)
}

const MyStickyHeader = ({children, heightProvider: [currentHeight, heightListeners]}) => {
  const headRef = React.useRef(null)
  React.useEffect(() => {
    const myListeners = heightListeners.current
    var height = currentHeight.current
    const capturedTop = headRef.current.getBoundingClientRect().top+window.scrollY
    const recomputeTop = () => {
      const targetPosition = Math.max(window.scrollY+height-capturedTop, 0)
      setTop(targetPosition)
    }
    recomputeTop()
    const myIndex = myListeners.push(newHeight => {
      height = newHeight
      recomputeTop()
    })-1
    window.addEventListener("scroll", recomputeTop)
    return () => {
      myListeners[myIndex] = ()=>{}
      window.removeEventListener("scroll", recomputeTop)
    }
  }, [currentHeight, heightListeners])
  const [top, setTop] = React.useState(0)
  return <Material.TableHead><Material.TableRow ref={headRef} style={{transform: "translate(0,"+top+"px)"}}>{children}</Material.TableRow></Material.TableHead>
}

const TransportViewStyle = {
  font: "20px Arial, sans-serif"
}

const transportItemGenerator = (data, index, setSelTab) => {
  const fmt = str => str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16)
  var backgroundColor = "white"
  if (data.status === "Recommended") {
    backgroundColor = "rgb(230, 255, 230)"
  }
  else {
    const timeDelta = Math.min(Math.min(new Date(fmt(data.startDateTime)))||Infinity, Math.min(new Date(fmt(data.endDateTime)))||Infinity)-(new Date())
    if (timeDelta < 1296000000) {
      backgroundColor = "rgb(255, 230, 230)"
    }
    else if (timeDelta < 1555200000) {
      backgroundColor = "rgb(255, 255, 204)"
    }
  }
  return (
    <Material.TableRow style={{backgroundColor}} key={data.internalUID} onClick={() => {
      addDetailTab(data, index)
      setSelTab(Infinity)
    }}>
      <Material.TableCell>{data.system ?? "Stingray 2.4km route"}</Material.TableCell>
      <Material.TableCell>{data.name}</Material.TableCell>
      <Material.TableCell>{data.startDateTime}</Material.TableCell>
      <Material.TableCell>{data.endDateTime}</Material.TableCell>
      <Material.TableCell>{data.unit}</Material.TableCell>
      <Material.TableCell>{data.company}</Material.TableCell>
      <Material.TableCell>{data.POC}</Material.TableCell>
      <Material.TableCell>{data.POCPhone}</Material.TableCell>
      <Material.TableCell>{data.notes}</Material.TableCell>
      <Material.TableCell>{data.status}</Material.TableCell>
    </Material.TableRow>
  )
}

const detailItemGenerator = (data, index) => {
  return (
    <Material.TableRow key={data.internalUID}>
      <Material.TableCell>{data.system ?? "Stingray 2.4km route"}</Material.TableCell>
      <Material.TableCell>{data.name}</Material.TableCell>
      <Material.TableCell>{data.startDateTime}</Material.TableCell>
      <Material.TableCell>{data.endDateTime}</Material.TableCell>
      <Material.TableCell>{data.unit}</Material.TableCell>
      <Material.TableCell>{data.company}</Material.TableCell>
      <Material.TableCell>{data.POC}</Material.TableCell>
      <Material.TableCell>{data.POCPhone}</Material.TableCell>
      <Material.TableCell>{data.notes}</Material.TableCell>
    </Material.TableRow>
  )
}

const notificationItemGenerator = (data, index, key, setSelTab) => {
  return (
    <Material.TableRow key={key} onClick={() => {
      addDetailTab(data, index)
      setSelTab(Infinity)
    }}><Material.TableCell style={notificationItemStyle(data.latest)} align="center">{data.title}</Material.TableCell></Material.TableRow>
  )
}

const notificationItemStyle = (latest) => {
  if (latest === false) {
    return {
      color: "grey"
    }
  }
  else {
    return {}
  }
}

const addDetailTab = (data, index) => {
  addTab({type: "detail", params: [tabID, index]})
  tabID++
}

const addNewTab = (cloneID) => {
  addTab({type: "newindent", params: [tabID, cloneID]})
  tabID++
}

const ListFactory = ({data, generator, style, header, tail}) => {
  return (
    <Material.TableContainer>
      <Material.Table stickyHeader>
        {header}
        <Material.TableBody>
          {data.map(generator)}
        </Material.TableBody>
        {tail}
      </Material.Table>
    </Material.TableContainer>
  )
}

const getCallbackSystem = (dataSource) => {

  const registeredCallbacks = []

  const registerCallback = (callback) => {
    return registeredCallbacks.push(callback)-1
  }

  const deregisterCallback = (id) => {
    if (id > -1 && id < registeredCallbacks.length) {
      registeredCallbacks[id] = ()=>{}
    }
  }
  
  const notifyNewData = () => {
    for (const callback of registeredCallbacks) {
      callback(dataSource())
    }
  }

  return [registerCallback, deregisterCallback, notifyNewData]
}

var dataStore = []

const readNotifications = () => {
  return notificationsStore
}

var notificationsStore = []

const statuses = ["Pending", "Submitted", "Recommended", "Hidden"]

const formFields = [{name: "emailsNotify", initialData: [], friendlyName: "Email", fieldType: "multi", persistent: true, optional: true}, {name: "system", initialData: "Stingray 2.4km route", friendlyName: "Resource", fieldType: "select", options: ["Stingray 2.4km route", "Temasek Square - Left", "Temasek Square - Right", "Temasek Square running route", "MPH", "Bde Audit", "Bde Mess"]}, {name: "name", initialData: "", friendlyName: "Purpose"}, {name: "startDateTime", initialData: "", friendlyName: "Start time", fieldType: "datetime"}, {name: "endDateTime", initialData: "", friendlyName: "End time", fieldType: "datetime"}, {name: "unit", initialData: "", friendlyName: "Unit"}, {name: "company", initialData: "", friendlyName: "Company"}, {name: "POC", initialData: "", friendlyName: "Contact person"}, {name: "POCPhone", initialData: "", friendlyName: "Contact person number"}, {name: "notes", initialData: "", friendlyName: "Notes", optional: true}]

const dataDefaults = [{name: "status", initialData: "Pending", friendlyName: "Status"}]

const detailFields = [...formFields.slice(1)]

const displayFields = [...formFields.slice(1), ...dataDefaults]

const fieldToFriendly = {}

const fieldAttributes = {}

const prefillConverters = {
  "startDateTime": str => {
    const date = new Date(str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16))
    date.setMinutes(date.getMinutes()-date.getTimezoneOffset())
    return date.toISOString().substring(0, 16)
  },
  "endDateTime": str => {
    const date = new Date(str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16))
    date.setMinutes(date.getMinutes()-date.getTimezoneOffset())
    return date.toISOString().substring(0, 16)
  }
}

const sortMaterializers = {
  "startDateTime": str => {
    const date = new Date(str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16))
    return date.getTime()
  },
  "endDateTime": str => {
    const date = new Date(str.slice(6,10)+"-"+str.slice(3,5)+"-"+str.slice(0,2)+"T"+str.slice(11,16))
    return date.getTime()
  }
}

for (const description of displayFields) {
  fieldToFriendly[description.name] = description.friendlyName
}

for (const description of [...formFields, ...dataDefaults]) {
  fieldAttributes[description.name] = {persistent: description.persistent, optional: description.optional}
}

const Tabs = ({childWrapper, childContext, children, selTab, setSelTab, appbarRef}) => {
  const pre = [(<Material.Tab style={{opacity: 1, minWidth: 0, minHeight:0, padding: 0}} disableRipple selected label={<div style={{height: "48px", width: "48px"}}><img src={appLogo} height="48px" width="48px"/></div>}/>)]
  const post = [(<Material.Tab style={{opacity: 1, minWidth: 0, minHeight:0, padding: 0}} disableRipple selected label={<Material.IconButton onClick={() => {
    addNewTab()
    setSelTab(Infinity)
  }} size="small" className="MuiTab-textColorInherit"><AddIcon style={{color: "white"}}/></Material.IconButton>}/>)]
  const ChildWrapper = childWrapper
  return (
    <div>
      <Material.AppBar position="sticky" style={{top: "env(safe-area-inset-top)"}} ref={appbarRef}>
        <Material.Tabs variant="scrollable" value={Math.min(selTab, children.length-1)+pre.length}>
          {[...pre , ...children.map((child, index) => {
            const obj = {...child.props, removeCallback: () => child.props.removeCallback(index, children.length), onClick: () => {setSelTab(index)}, active: index === Math.min(selTab, children.length-1), key: child.props.mykey}
            return (<Tab {...obj}></Tab>)
          }), ...post]}
        </Material.Tabs>
      </Material.AppBar>
      <div>
        <ChildWrapper childContext={childContext} mykey={children[Math.min(selTab, children.length-1)].props.mykey}>
          {children[Math.min(selTab, children.length-1)]}
        </ChildWrapper>
      </div>
    </div>
  )
}

const Tab = ({label, onClick, active, removable, removeCallback}) => {
  return (
    <Material.Tab style={{padding: 0}} disableRipple selected label={(<span><Material.Tab label={label} onClick={onClick} selected={active ? true : null}/>
      {removable ? (<Material.IconButton size="small" onClick={removeCallback}><Icons.Close style={{fill: "red"}}/></Material.IconButton>) : undefined}
      </span>)}/>
  )
}

const TabCloseStyle = {
  font: "16px Arial, sans-serif",
  margin: "auto"
}

const [registerCallback, deregisterCallback, notifyNewData] = getCallbackSystem(readRange)

const [registerNotify, deregisterNotify, notifyNewN] = getCallbackSystem(readNotifications)

ReactDOM.render(
  <div style={{textAlign: "center"}}>
    <App/>
  </div>,
  document.getElementById('root')
);
