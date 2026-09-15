const url = "https://loqigszcsyrcrepmpqgn.supabase.co/rest/v1/invoices?select=*&limit=1";
const key = "sb_publishable_vEyR2FxkDGBqkAvGJPI1Vg_9iNmRj3Y";

fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key } })
    .then(res => res.json())
    .then(data => {
        console.log("INVOICES FETCH DATA:", data);
    })
    .catch(err => console.error(err));
