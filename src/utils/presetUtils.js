const stateAbbreviations = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

const normalizeString = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const fetchXMLPresets = async () => {
    try {
        const response = await fetch('/rest-tree-webapp/ArcGIS Server List.xml');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const connections = xmlDoc.getElementsByTagName('arcgisfeatureserver');
        const newPresets = Array.from(connections).map(connection => ({
            name: connection.getAttribute('name'),
            url: connection.getAttribute('url')
        }));
        
        return newPresets;
    } catch (error) {
        console.error('Error loading XML presets:', error);
        throw error;
    }
};

export const handlePresetChange = (e, setSelectedPreset, setUrl) => {
    const selectedUrl = e.target.value;
    setSelectedPreset(selectedUrl);
    setUrl(selectedUrl);
};

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

export const handlePresetInputChange = (() => {
    const debouncedFilter = debounce((input, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex) => {
        if (input.length > 0) {
            const words = input.split(/\s+/);
            const expandedWords = words.map(word => {
                if (word.length === 2 && word === word.toUpperCase() && stateAbbreviations[word]) {
                    return stateAbbreviations[word];
                }
                return word;
            });
            const expandedInput = expandedWords.join(' ');
            const normalizedInput = normalizeString(expandedInput);
            
            const filtered = presets.filter(preset => {
                const normalizedName = normalizeString(preset.name);
                const normalizedUrl = normalizeString(preset.url);
                return normalizedName.includes(normalizedInput) || normalizedUrl.includes(normalizedInput);
            });
            
            setFilteredPresets(filtered);
        } else {
            setFilteredPresets(presets);
        }
        setShowPresetDropdown(true);
        setHighlightedIndex(-1);
    }, 300);

    return (e, setSelectedPreset, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex) => {
        const input = e.target.value;
        setSelectedPreset(input);
        debouncedFilter(input, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex);
    };
})();

export const handlePresetSelect = (preset, setSelectedPreset, setUrl, setShowPresetDropdown, setHighlightedIndex) => {
    setSelectedPreset(preset.name);
    setUrl(preset.url);
    setShowPresetDropdown(false);
    setHighlightedIndex(-1);
};

export const handlePresetInputFocus = (setFilteredPresets, presets, setShowPresetDropdown, setHighlightedIndex) => {
    setFilteredPresets(presets);
    setShowPresetDropdown(true);
    setHighlightedIndex(-1);
};