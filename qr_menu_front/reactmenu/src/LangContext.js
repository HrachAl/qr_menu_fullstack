import { createContext, useContext, useEffect, useState, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

const LangContext = createContext();

export const LangProvider = ({ children }) => {
    const [langItems, setLangItems] = useState([]);
    const [lang, setLang] = useState('AM');
    const [addAll, setAddAll] = useState('Add all');
    const [add, setAdd] = useState('Add');
    const [min, setMin] = useState('minute');
    const [amd, setAmd] = useState('AMD');
    const [sub, setSub] = useState('Confirm');
    const [tot, setTot] = useState('Total Price');
    const [cl, setCl] = useState('Close The tab');
    const [write, setWrite] = useState('Write a message...');
    const [menuTypes, setMenuTypes] = useState([]);
    const [menuError, setMenuError] = useState(null);
    const [menuVersion, setMenuVersion] = useState(0);

    const refetchMenu = useCallback(() => {
        setMenuVersion((v) => v + 1);
    }, []);

    useEffect(() => {
        const langCode = lang === 'EN' ? 'en' : lang === 'RU' ? 'ru' : 'am';
        if (lang === 'EN') {
            setAdd('Add');
            setMin('minute');
            setAmd('AMD');
            setSub('Confirm');
            setTot('Total Price');
            setCl('Close The tab');
            setWrite('write a message...');
            setAddAll('Add all');
        } else if (lang === 'RU') {
            setAdd('добавить');
            setMin('минут');
            setAmd('др');
            setSub('подтвердить');
            setTot('общая стоимость');
            setCl('закрыть окно');
            setWrite('напишите сообщение...');
            setAddAll('Добавить все');
        } else {
            setAdd('Ավելացնել');
            setMin('րոպե');
            setAmd('դր');
            setSub('հաստատել');
            setTot('ընդհանուր');
            setCl('Փակել պատուհանը');
            setWrite('գրեք հաղորդագրություն...');
            setAddAll('Ավելացնել բոլորը');
        }
        setMenuError(null);
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('customer_token') : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        fetch(`${API_BASE}/api/menu?language=${langCode}`, { headers, cache: 'no-store' })
            .then(res => res.ok ? res.json() : Promise.reject(new Error(res.statusText)))
            .then(data => {
                setLangItems(Array.isArray(data) ? data : []);
                const types = [];
                (Array.isArray(data) ? data : []).forEach(item => {
                    if (!types.find(t => t.type === item.type)) {
                        types.push({ type: item.type, type_name: item.type_name });
                    }
                });
                setMenuTypes(types);
            })
            .catch(err => {
                setMenuError(err.message);
                setLangItems([]);
                setMenuTypes([]);
            });
    }, [lang, menuVersion]);

    return (
        <LangContext.Provider value={{
            langItems, setLang, lang, add, min, amd, sub, tot, cl, write, addAll, menuTypes, menuError, refetchMenu
        }}>
            {children}
        </LangContext.Provider>
    );
};

export const useLang = () => useContext(LangContext);
