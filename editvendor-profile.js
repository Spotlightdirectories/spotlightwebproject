document.addEventListener("DOMContentLoaded", async () => {

const supabase = window.supabaseClient;

// Show success message after reload
if (localStorage.getItem("profileUpdateSuccess") === "true") {
  const statusMsg = document.getElementById("statusMsg");
  statusMsg.textContent = "Profile updated successfully.";
  localStorage.removeItem("profileUpdateSuccess");
}

  let vendorData = {};
  let updatedFields = {};

  // ===============================
  // GET AUTH USER
  // ===============================
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;

  if (error) {
    console.error("Auth error:", error);
  }

  if (!user) {
    window.location.replace("login");
    return;
  }

  // ===============================
  // FETCH VENDOR RECORD
  // ===============================
  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (vendorError || !vendor) {
    console.error("Vendor fetch error:", vendorError);
    document.getElementById("statusMsg").textContent =
      "Unable to load your profile.";
    return;
  }

  // ===============================
  // RENDER DATA (READ-ONLY)
  // ===============================
  
  vendorData = vendor;

  document.getElementById("view-name").textContent = vendor.name || "";
  document.getElementById("view-email").textContent = vendor.email || "";

  document.getElementById("view-whatsapp").textContent = vendor.whatsapp || "";
  document.getElementById("view-telephone").textContent = vendor.telephone || "";
  document.getElementById("view-address").textContent = vendor.address || "";
  document.getElementById("view-description").textContent = vendor.description || "";

  document.getElementById("view-category").textContent = vendor.category || "";

  document.getElementById("view-state").textContent = vendor.state || "";


  // ===============================
// COORDINATE DETECTION (FROM ONBOARDING)
// ===============================
const detectBtn = document.getElementById("detectLocationBtn");
console.log("detectBtn:", detectBtn);

const latInput = document.getElementById("latitude");
const lngInput = document.getElementById("longitude");
const confirmCheckbox = document.getElementById("confirmLocationCheckbox");
const locationStatus = document.getElementById("locationStatus");

// PREFILL EXISTING VALUES
if (latInput && lngInput) {
  latInput.value = vendorData.latitude || "";
  lngInput.value = vendorData.longitude || "";
}

if (detectBtn) {
  detectBtn.addEventListener("click", () => {

    if (!confirmCheckbox.checked) {
      locationStatus.textContent =
        "Please confirm you are at your business location before detecting.";
      return;
    }

    if (!navigator.geolocation) {
      locationStatus.textContent = "Geolocation is not supported by your browser.";
      return;
    }

    locationStatus.textContent = "Detecting location...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude.toFixed(6);
        lngInput.value = pos.coords.longitude.toFixed(6);

        locationStatus.textContent =
          "Location detected successfully. Please confirm this is your business location.";

        const newLat = latInput.value;
        const newLng = lngInput.value;

        const originalLat = (vendorData.latitude ?? "").toString();
        const originalLng = (vendorData.longitude ?? "").toString();

        if (newLat !== originalLat) {
          updatedFields.latitude = parseFloat(newLat);
        } else {
          delete updatedFields.latitude;
        }

        if (newLng !== originalLng) {
          updatedFields.longitude = parseFloat(newLng);
        } else {
          delete updatedFields.longitude;
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        locationStatus.textContent =
          "Unable to retrieve location. Please allow location permission or enter manually.";
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}


    // ===============================
  // EDIT BUTTON HANDLING
  // ===============================
  const editButtons = document.querySelectorAll(".edit-btn");

  editButtons.forEach(btn => {
  btn.addEventListener("click", async () => {

    const field = btn.dataset.field;
    // Prevent duplicate UI for subcategory
    if (field === "subcategory") {
       return;
    }
    const viewEl = document.getElementById(`view-${field}`);
    const currentValue = vendorData[field] || "";

    // Prevent duplicate edit mode
    if (viewEl.querySelector("input") || viewEl.querySelector("textarea") || viewEl.querySelector("select")) {
      return;
    }

    let input;

    // ===============================
    // TEXTAREA FIELDS
    // ===============================
    if (field === "address" || field === "description") {
      input = document.createElement("textarea");
      input.value = currentValue;
      input.className = "edit-input";

      input.addEventListener("input", () => {
        const originalValue = (vendorData[field] ?? "").toString();
        const newValue = input.value.toString();

        if (newValue !== originalValue) {
          updatedFields[field] = newValue;
        } else {
          delete updatedFields[field];
        }
      });

      viewEl.textContent = "";
      viewEl.appendChild(input);
    }

    // ===============================
    // CATEGORY + SUBCATEGORY
    // ===============================
    else if (field === "category" || field === "subcategory") {

      const categorySelect = document.createElement("select");
      categorySelect.className = "edit-input";

      const subcategorySelect = document.createElement("select");
      subcategorySelect.className = "edit-input";

      viewEl.textContent = "";
      viewEl.appendChild(categorySelect);
      viewEl.appendChild(subcategorySelect);

      const { data: categories } = await supabase
        .from("categories")
        .select("id, name");

      categorySelect.innerHTML = `<option value="">Select Category</option>`;

      categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.name;

        if (cat.name === vendorData.category) {
          opt.selected = true;
        }

        categorySelect.appendChild(opt);
      });

      const loadSubcategories = async (categoryId) => {
        subcategorySelect.innerHTML = `<option>Loading...</option>`;

        const { data: subs } = await supabase
          .from("subcategories")
          .select("id, name")
          .eq("category_id", categoryId);

        subcategorySelect.innerHTML = `<option value="">Select Subcategory</option>`;

        subs.forEach(sub => {
          const opt = document.createElement("option");
          opt.value = sub.id;
          opt.textContent = sub.name;

          if (sub.name === vendorData.subcategory) {
            opt.selected = true;
          }

          subcategorySelect.appendChild(opt);
        });
      };

      if (categorySelect.value) {
        await loadSubcategories(categorySelect.value);
      }

      categorySelect.addEventListener("change", async () => {
        const selectedText = categorySelect.options[categorySelect.selectedIndex].text;

        updatedFields.category = selectedText;
        updatedFields.category_id = categorySelect.value;

        await loadSubcategories(categorySelect.value);
      });

      subcategorySelect.addEventListener("change", () => {
        const selectedText = subcategorySelect.options[subcategorySelect.selectedIndex].text;

        updatedFields.subcategory = selectedText;
        updatedFields.subcategory_id = subcategorySelect.value;
      });

      return;
    }

    else if (field === "state" || field === "lga") {

  if (viewEl.querySelector("select")) return;

  const stateSelect = document.createElement("select");
  stateSelect.className = "edit-input";

  const lgaSelect = document.createElement("select");
  lgaSelect.className = "edit-input";

  viewEl.textContent = "";
  viewEl.appendChild(stateSelect);
  viewEl.appendChild(lgaSelect);

  const nigeriaData = {
    "Abia": ["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Isuikwuato","Obi Ngwa","Ohafia","Osisioma","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South","Umu Nneochi"],
    "Adamawa": ["Demsa","Fufore","Ganye","Girei","Gombi","Guyuk","Hong","Jada","Lamurde","Madagali","Maiha","Mayo-Belwa","Michika","Mubi North","Mubi South","Numan","Shelleng","Song","Toungo","Yola North","Yola South"],
    "Akwa Ibom": ["Abak","Eastern Obolo","Eket","Esit-Eket","Essien Udim","Etim Ekpo","Etinan","Ibeno","Ibesikpo Asutan","Ibiono Ibom","Ika","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Mkpat-Enin","Nsit-Atai","Nsit-Ibom","Nsit-Ubium","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Udung-Uko","Ukanafun","Uruan","Urue-Offong/Oruko","Uyo"],
    "Anambra": ["Aguata","Anambra East","Anambra West","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South","Oyi"],
    "Bauchi": ["Alkaleri","Bauchi","Bogoro","Damban","Darazo","Dass","Gamawa","Ganjuwa","Giade","Itas/Gadau","Jama'are","Katagum","Kirfi","Misau","Ningi","Shira","Tafawa Balewa","Toro","Warji","Zaki"],
    "Bayelsa": ["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
    "Benue": ["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Ohimini","Oju","Okpokwu","Otukpo","Tarka","Ukum","Ushongo","Vandeikya"],
    "Borno": ["Abadam","Askira/Uba","Bama","Bayo","Biu","Chibok","Damboa","Dikwa","Gubio","Guzamala","Gwoza","Hawul","Jere","Kaga","Kala/Balge","Konduga","Kukawa","Kwaya Kusar","Mafa","Magumeri","Maiduguri","Marte","Mobbar","Monguno","Ngala","Nganzai","Shani"],
    "Cross River": ["Abi","Akamkpa","Akpabuyo","Bakassi","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakuur","Yala"],
    "Delta": ["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
    "Ebonyi": ["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
    "Edo": ["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Orhionmwon","Oredo","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
    "Ekiti": ["Ado-Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
    "Enugu": ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo-Uwani"],
    "Gombe": ["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shongom","Yamaltu/Deba"],
    "Imo": ["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Onuimo","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West"],
    "Jigawa": ["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kazaure","Kiri Kasama","Kiyawa","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
    "Kaduna": ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
    "Kano": ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
    "Katsina": ["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dandume","Danja","Dan Musa","Daura","Dutsi","Dutsin Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Mai’Adua","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
    "Kebbi": ["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
    "Kogi": ["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
    "Kwara": ["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke Ero","Oyun","Pategi"],
    "Lagos": ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
    "Nasarawa": ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
    "Niger": ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Muya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
    "Ogun": ["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Shagamu"],
    "Ondo": ["Akoko North-East","Akoko North-West","Akoko South-West","Akoko South-East","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
    "Osun": ["Atakunmosa East","Atakunmosa West","Aiyedaade","Aiyedire","Boluwaduro","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo Otin","Ola Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
    "Oyo": ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
    "Plateau": ["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
    "Rivers": ["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio/Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
    "Sokoto": ["Binji","Bodinga","Dange Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
    "Taraba": ["Ardo Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim Lamido","Kumi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
    "Yobe": ["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
    "Zamfara": ["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata Mafara","Chafe","Zurmi"],
    "FCT": ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"]
  };

  // Load states
  stateSelect.innerHTML = `<option value="">Select State</option>`;

  Object.keys(nigeriaData).forEach(state => {
    const opt = document.createElement("option");
    opt.value = state;
    opt.textContent = state;

    if (state === vendorData.state) {
      opt.selected = true;
    }

    stateSelect.appendChild(opt);
  });

  const loadLGAs = (state) => {
    lgaSelect.innerHTML = `<option value="">Select LGA</option>`;

    if (!nigeriaData[state]) return;

    nigeriaData[state].forEach(lga => {
      const opt = document.createElement("option");
      opt.value = lga;
      opt.textContent = lga;

      if (lga === vendorData.lga) {
        opt.selected = true;
      }

      lgaSelect.appendChild(opt);
    });
  };

  // Initial load
  if (stateSelect.value) {
    loadLGAs(stateSelect.value);
  }

  // State change
stateSelect.addEventListener("change", () => {
  const selectedState = stateSelect.value;
  const originalState = (vendorData.state ?? "").toString();

  if (selectedState !== originalState) {
    updatedFields.state = selectedState;
  } else {
    delete updatedFields.state;
  }

  loadLGAs(selectedState);
});

  // LGA change
lgaSelect.addEventListener("change", () => {
  const selectedLga = lgaSelect.value;
  const originalLga = (vendorData.lga ?? "").toString();

  if (selectedLga !== originalLga) {
    updatedFields.lga = selectedLga;
  } else {
    delete updatedFields.lga;
  }
});

  return;
}

    // ===============================
    // INPUT FIELDS (DEFAULT)
    // ===============================
    else {
      input = document.createElement("input");
      input.type = "text";
      input.className = "edit-input";

      if (field === "whatsapp") {

        let clean = String(currentValue || "").replace(/\D/g, "");

        if (clean.startsWith("0")) clean = "234" + clean.slice(1);
        if (clean.startsWith("2340")) clean = "234" + clean.slice(4);
        if (!clean.startsWith("234")) clean = "234";

        input.value = "+234" + clean.replace(/^234/, "");

        input.addEventListener("input", () => {
          let raw = input.value.replace("+234", "");

          raw = raw.replace(/\D/g, "");
          if (raw.startsWith("0")) raw = raw.slice(1);
          raw = raw.slice(0, 10);

          input.value = "+234" + raw;

          const newValue = "234" + raw;
          const originalValue = (vendorData[field] ?? "").toString();

          if (newValue !== originalValue) {
            updatedFields[field] = newValue;
          } else {
            delete updatedFields[field];
          }
        });

      } else {
        input.value = currentValue;

        input.addEventListener("input", () => {
          const originalValue = (vendorData[field] ?? "").toString();
          const newValue = input.value.toString();

          if (newValue !== originalValue) {
            updatedFields[field] = newValue;
          } else {
            delete updatedFields[field];
          }
        });
      }

      viewEl.textContent = "";
      viewEl.appendChild(input);
    }

  });
});
    // ===============================
  // SAVE BUTTON HANDLING
  // ===============================
  const saveBtn = document.getElementById("saveBtn");
  console.log("Save button:", saveBtn);

  saveBtn.addEventListener("click", async () => {
    console.log("updatedFields at click:", updatedFields);
    console.log("Save button clicked");

    // Nothing changed
if (Object.keys(updatedFields).length === 0) {
  console.log("No changes branch triggered");

const statusMsg = document.getElementById("statusMsg");

statusMsg.textContent = "No changes to save.";

console.log("statusMsg element:", statusMsg);

  return;
}

    saveBtn.disabled = true;
    document.getElementById("statusMsg").textContent = "Saving changes...";

    const { error } = await supabase
      .from("vendors")
      .update(updatedFields)
      .eq("auth_user_id", user.id);

    if (error) {
      console.error("Update error:", error);
      document.getElementById("statusMsg").textContent = error.message;
      saveBtn.disabled = false;
      return;
    }

    document.getElementById("statusMsg").textContent = "Profile updated successfully.";

    // Reset tracking
    updatedFields = {};

    // Persist message across reload
    localStorage.setItem("profileUpdateSuccess", "true");

    window.location.reload();

  });

});