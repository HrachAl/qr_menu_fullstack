import { useState } from "react"
import { useLang } from "../LangContext"
import { TbWorld } from "react-icons/tb"

export default function LangButton() {
    const {setLang, lang} = useLang()
    const [active, setActive] = useState(false)
    const [first, setFirst] = useState('AM')
    const [sec, setSec] = useState('RU')
    const [third, setThird] = useState('EN')
    const handleClick = () => {
        setActive(!active)
    }
    return(
        <div className="langButton" style={{height: active ? '66px' : ''}} onClick={handleClick}>
            {active ? (
                        <>
                            <div className="lang en"><p>{lang}</p></div>
                            <div className="lang ru" onClick={() => { setLang(sec); const temp = first; setFirst(sec); setSec(temp);}}><p>{sec}</p></div>
                            <div className="lang arm" onClick={() => { setLang(third); const temp = first; setFirst(third); setThird(temp); }}><p>{third}</p></div>
                        </>
                    ) : (
                    <div className="box"><p><TbWorld /></p></div>
                    )}
        </div>

    )
}