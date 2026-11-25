// Hand-written: the domestic side that plays at each ground and a few names the city is known for.
// Only filled in where we are sure; a ground with no entry simply shows nothing extra.
const T: Record<string, string> = {
    Kolkata: 'Bengal', Delhi: 'Delhi', Chennai: 'Tamil Nadu', Mumbai: 'Mumbai', Bengaluru: 'Karnataka', Kanpur: 'Uttar Pradesh', Lucknow: 'Uttar Pradesh',
    Mohali: 'Punjab', Jalandhar: 'Punjab', Chandigarh: 'Chandigarh', Indore: 'Madhya Pradesh', Rajkot: 'Saurashtra', Visakhapatnam: 'Andhra', Pune: 'Maharashtra',
    Ranchi: 'Jharkhand', Cuttack: 'Odisha', Dharamsala: 'Himachal Pradesh', Guwahati: 'Assam', Ahmedabad: 'Gujarat', Nagpur: 'Vidarbha', Jaipur: 'Rajasthan',
    London: 'Middlesex', Manchester: 'Lancashire', Leeds: 'Yorkshire', Nottingham: 'Nottinghamshire', Birmingham: 'Warwickshire', Southampton: 'Hampshire', 'Chester-le-Street': 'Durham',
    Melbourne: 'Victoria', Sydney: 'New South Wales', Adelaide: 'South Australia', Brisbane: 'Queensland', Perth: 'Western Australia',
    'Port of Spain': 'Trinidad & Tobago', Kingston: 'Jamaica', Bridgetown: 'Barbados', "St John's": 'Leeward Islands', 'North Sound': 'Leeward Islands', Basseterre: 'Leeward Islands', 'Gros Islet': 'Windward Islands', Roseau: 'Windward Islands',
    Wellington: 'Wellington Firebirds', Auckland: 'Auckland Aces', Christchurch: 'Canterbury', Hamilton: 'Northern Districts', Dunedin: 'Otago', Napier: 'Central Districts',
    Johannesburg: 'Lions', 'Cape Town': 'Western Province', Durban: 'Dolphins (KwaZulu-Natal)', Centurion: 'Titans', Lahore: 'Lahore', Karachi: 'Karachi', Faisalabad: 'Faisalabad', Rawalpindi: 'Rawalpindi',
    Colombo: '', Galle: '', Kandy: '', Dhaka: 'Dhaka', Chattogram: 'Chattogram',
};
const IPL: Record<string, string> = {
    'Eden Gardens|Kolkata': 'Kolkata Knight Riders', 'Arun Jaitley Stadium (Feroz Shah Kotla)|Delhi': 'Delhi Capitals', 'MA Chidambaram Stadium (Chepauk)|Chennai': 'Chennai Super Kings',
    'Wankhede Stadium|Mumbai': 'Mumbai Indians', 'M Chinnaswamy Stadium|Bengaluru': 'Royal Challengers Bengaluru', 'Rajiv Gandhi International Stadium|Hyderabad': 'Sunrisers Hyderabad',
    'Narendra Modi Stadium (Motera)|Ahmedabad': 'Gujarat Titans', 'Sawai Mansingh Stadium|Jaipur': 'Rajasthan Royals',
};
const S: Record<string, string[]> = {
    Kolkata: ['Sourav Ganguly', 'Pankaj Roy', 'Mohammed Shami'], Delhi: ['Virender Sehwag', 'Virat Kohli', 'Gautam Gambhir', 'Bishan Bedi'], Chennai: ['R Ashwin', 'Krishnamachari Srikkanth', 'S Venkataraghavan'],
    Mumbai: ['Sachin Tendulkar', 'Sunil Gavaskar', 'Rohit Sharma', 'Vijay Merchant'], Bengaluru: ['Rahul Dravid', 'Anil Kumble', 'Gundappa Viswanath', 'KL Rahul'],
    Kanpur: ['Kuldeep Yadav', 'Suresh Raina', 'Mohammad Kaif', 'Bhuvneshwar Kumar'], Lucknow: ['Kuldeep Yadav', 'Suresh Raina', 'Mohammad Kaif', 'Bhuvneshwar Kumar'],
    Mohali: ['Yuvraj Singh', 'Harbhajan Singh', 'Shubman Gill', 'Navjot Sidhu'], Jalandhar: ['Yuvraj Singh', 'Harbhajan Singh', 'Shubman Gill'],
    Indore: ['Rajat Patidar', 'Avesh Khan', 'Naman Ojha'], Rajkot: ['Cheteshwar Pujara', 'Ravindra Jadeja', 'Jaydev Unadkat'], Visakhapatnam: ['Hanuma Vihari', 'KS Bharat', 'MSK Prasad'],
    Pune: ['Ruturaj Gaikwad', 'Kedar Jadhav', 'Rahul Tripathi'], Ranchi: ['MS Dhoni', 'Ishan Kishan', 'Varun Aaron'], Cuttack: ['Debasis Mohanty', 'Shiv Sunder Das', 'Basant Mohanty'],
    Dharamsala: ['Rishi Dhawan', 'Ankush Bains', 'Mayank Dagar'], Guwahati: ['Riyan Parag'], Ahmedabad: ['Jasprit Bumrah', 'Parthiv Patel', 'Axar Patel'], Nagpur: ['Umesh Yadav', 'Faiz Fazal', 'Wasim Jaffer'],
    Jaipur: ['Pankaj Singh', 'Ashok Menaria'],
    London: ['Denis Compton', 'Mike Gatting', 'Andrew Strauss', 'Jack Hobbs'], Manchester: ['James Anderson', 'Andrew Flintoff', 'Mike Atherton'], Leeds: ['Geoffrey Boycott', 'Joe Root', 'Fred Trueman', 'Len Hutton'],
    Nottingham: ['Stuart Broad', 'Harold Larwood', 'Derek Randall'], Birmingham: ['Ian Bell', 'Bob Willis', 'Dennis Amiss', 'Rohan Kanhai'], Southampton: ['Shane Warne', 'Malcolm Marshall', 'Barry Richards', 'Andy Roberts'],
    'Chester-le-Street': ['Ben Stokes', 'Paul Collingwood', 'Mark Wood'],
    Melbourne: ['Shane Warne', 'Bill Ponsford', 'Dean Jones', 'Glenn Maxwell'], Sydney: ['Don Bradman', 'Steve Waugh', 'Brett Lee', 'Steve Smith'], Adelaide: ['Clem Hill', 'Ian Chappell', 'Greg Chappell', 'Darren Lehmann'],
    Brisbane: ['Allan Border', 'Matthew Hayden', 'Ian Healy'], Perth: ['Dennis Lillee', 'Rod Marsh', 'Justin Langer', 'Mitchell Johnson'],
    'Port of Spain': ['Brian Lara', 'Learie Constantine', 'Sunil Narine', 'Dwayne Bravo'], Kingston: ['George Headley', 'Michael Holding', 'Courtney Walsh', 'Chris Gayle'],
    Bridgetown: ['Garfield Sobers', 'Gordon Greenidge', 'Malcolm Marshall', 'Joel Garner'], "St John's": ['Viv Richards', 'Andy Roberts', 'Richie Richardson', 'Curtly Ambrose'], 'North Sound': ['Viv Richards', 'Andy Roberts', 'Richie Richardson', 'Curtly Ambrose'],
    'Gros Islet': ['Darren Sammy', 'Shane Shillingford'],
    Wellington: ['Martin Crowe'], Auckland: ['Martin Crowe', 'Martin Guptill', 'Colin Munro'], Christchurch: ['Richard Hadlee', 'Chris Cairns'], Hamilton: ['Kane Williamson', 'BJ Watling', 'Trent Boult'], Dunedin: ['Brendon McCullum', 'Glenn Turner'],
    'Cape Town': ['Jacques Kallis', 'Gary Kirsten', 'Dale Steyn'], Durban: ['Hashim Amla', 'Shaun Pollock', 'Barry Richards', 'Lance Klusener'], Centurion: ['AB de Villiers', 'Faf du Plessis'],
    Lahore: ['Imran Khan', 'Wasim Akram'], Karachi: ['Javed Miandad', 'Hanif Mohammad', 'Wasim Bari'], Rawalpindi: ['Shoaib Akhtar'], Colombo: ['Mahela Jayawardene', 'Marvan Atapattu'], Kandy: ['Muttiah Muralitharan'], Chattogram: ['Tamim Iqbal'],
};
export function groundInfo(name: string, city: string, country: string): { team: string; stars: string[] } | null {
    let team = T[city] || '';
    if (city === 'Hyderabad') team = country === 'India' ? 'Hyderabad' : 'Hyderabad (Sindh)';
    const ipl = IPL[name + '|' + city]; if (ipl && team) team += ' · ' + ipl + ' (IPL)'; else if (ipl) team = ipl + ' (IPL)';
    const stars = city === 'Hyderabad' && country === 'India' ? ['Mohammad Azharuddin', 'VVS Laxman', 'Mohammed Siraj', 'Pragyan Ojha'] : (S[city] || []);
    return team || stars.length ? { team, stars } : null;
}
