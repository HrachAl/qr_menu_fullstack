import { createContext, useContext, useEffect, useState } from "react";
import menuAmData from "./menu_am.json";
import menuEnData from "./menu_en.json";
import menuRuData from "./menu_ru.json";

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

    useEffect(() => {
        let newLangItems;
        if (lang === 'EN') {
            newLangItems = menuEnData;
            setAdd('Add');
            setMin('minute');
            setAmd('AMD');
            setSub('Confirm');
            setTot('Total Price');
            setCl('Close The tab');
            setWrite('write a message...');
            setAddAll('Add all');
        } else if (lang === 'RU') {
            newLangItems = menuRuData;
            setAdd('добавить');
            setMin('минут');
            setAmd('др');
            setSub('подтвердить');
            setTot('общая стоимость');
            setCl('закрыть окно');
            setWrite('напишите сообщение...');
            setAddAll('Добавить все');
        } else {
            newLangItems = menuAmData;
            setAdd('Ավելացնել');
            setMin('րոպե');
            setAmd('դր');
            setSub('հաստատել');
            setTot('ընդհանուր');
            setCl('Փակել պատուհանը');
            setWrite('գրեք հաղորդագրություն...');
            setAddAll('Ավելացնել բոլորը');
        }

        setLangItems(newLangItems);

        const types = [];
        newLangItems.forEach(item => {
            if (!types.find(t => t.type === item.type)) {
                types.push({
                    type: item.type,
                    type_name: item.type_name
                });
            }
        });
        setMenuTypes(types);

    }, [lang]);

    return (
        <LangContext.Provider value={{
            langItems, setLang, lang, add, min, amd, sub, tot, cl, write, addAll, menuTypes
        }}>
            {children}
        </LangContext.Provider>
    );
};

export const useLang = () => useContext(LangContext);
