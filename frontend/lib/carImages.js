/**
 * 차량 모델명 → 이미지 파일명 매핑
 * match_img.txt 기반으로 생성
 * 이미지는 /public/car_img/ 폴더에 위치
 */

const CAR_IMAGE_MAP = {
  // BMW / MINI
  "MINI Aceman E": "MINI Aceman.png",
  "MINI Aceman SE": "MINI Aceman.png",
  "MINI Cooper SE": "MINI Cooper SE.png",
  "MINI Countryman E": "MINI Countryman.png",
  "MINI Countryman SE ALL4": "MINI Countryman.png",
  "MINI JCW Aceman E": "MINI Aceman.png",
  "MINI JCW E": "MINI Cooper SE.png",
  "i4 M60 LCI (71HD)": "i4.png",
  "i4 eDrive 40 LCI(21HD)": "i4.png",
  "i4 eDrive 40 LCI(61HD)": "i4.png",
  "i5 eDrive 40": "i5.png",
  "iX1 eDrive20": "ix1.png",
  "iX1 eDrive20(11HM)": "ix1.png",
  "iX1 xDrive30": "ix1.png",
  "iX2 eDrive20": "ix2.png",
  "iX2 eDrive20(71GN)": "ix2.png",
  "iX3 50 xDrive": "ix3.png",

  // 기아
  "(단종)The all-new Kia Niro EV": "niro.webp",
  "EV3 GT": "ev3.png",
  "EV3 롱레인지 2WD 17인치": "ev3.png",
  "EV3 롱레인지 2WD 19인치": "ev3.png",
  "EV3 롱레인지 4WD 19인치": "ev3.png",
  "EV3 스탠다드 2WD": "ev3.png",
  "EV4 GT": "ev4.png",
  "EV4 롱레인지 2WD 17인치": "ev4.png",
  "EV4 롱레인지 2WD 19인치": "ev4.png",
  "EV4 롱레인지 4WD 19인치": "ev4.png",
  "EV4 롱레인지 GTL 2WD 19인치": "ev4.png",
  "EV4 스탠다드 2WD 17인치": "ev4.png",
  "EV4 스탠다드 2WD 19인치": "ev4.png",
  "EV5 GT": "ev5.png",
  "EV5 롱레인지 2WD": "ev5.png",
  "EV5 롱레인지 4WD 18인치": "ev5.png",
  "EV5 롱레인지 4WD 19인치": "ev5.png",
  "EV9 GT": "ev9.png",
  "EV9 롱레인지 2WD 19인치": "ev9.png",
  "EV9 롱레인지 2WD 20인치": "ev9.png",
  "EV9 롱레인지 4WD 19인치": "ev9.png",
  "EV9 롱레인지 4WD 21인치": "ev9.png",
  "EV9 롱레인지 GTL 4WD 21인치": "ev9.png",
  "EV9 스탠다드": "ev9.png",
  "PV5 패신저 5인승 롱레인지": "pv5.png",
  "Pv5 WAV(비용 미지원)": "pv5.png",
  "Pv5 WAV(비용 지원)": "pv5.png",
  "더뉴EV6 롱레인지 2WD 19인치": "ev6.png",
  "더뉴EV6 롱레인지 2WD 20인치": "ev6.png",
  "더뉴EV6 롱레인지 4WD 19인치": "ev6.png",
  "더뉴EV6 롱레인지 4WD 20인치": "ev6.png",
  "더뉴EV6 스탠다드": "ev6.png",
  "레이 EV 2WD 14인치 1인승 밴": "ray.png",
  "레이 EV 2WD 14인치 2인승 밴": "ray.png",
  "레이 EV 2WD 14인치 4인승 승용": "ray.png",

  // 메르세데스벤츠
  "EQA 250(Facelift)": "eqa.png",
  "EQB 300 4MATIC(Facelift)": "eqb.png",
  "EQB 300 4MATIC(Facelift)(CY25/2)": "eqb.png",

  // 볼보
  "볼보 EX30 Single Motor ER": "ex30.png",
  "볼보 EX30CC Twin Motor Perf": "ex30cc.png",

  // BYD
  "(단종)BYD ATTO 3": "atto.png",
  "(단종)BYD DOLPHIN": "dolphin.png",
  "(단종)BYD DOLPHIN Active": "dolphin.png",
  "(단종)BYD SEAL": "seal.png",
  "(단종)BYD SEAL Dynamic AWD": "seal.png",
  "(단종)BYD SEALION 7": "sealion.png",

  // KGM
  "(단종)토레스 EVX 2WD 18인치": "torres.png",
  "(단종)토레스 EVX 2WD 20인치": "torres.png",
  "토레스 EVX 18인치": "torres.png",
  "토레스 EVX 18인치(2026)": "torres.png",
  "토레스 EVX 20인치": "torres.png",
  "토레스 EVX 20인치(2026)": "torres.png",

  // 테슬라
  "Model 3 Performance": "model3.png",
  "Model 3 Premium Long Range RWD": "model3.png",
  "Model 3 Premium Long Range RWD(5999만원)": "model3.png",
  "Model 3 RWD": "model3.png",
  "Model 3 RWD(2025)": "model3.png",
  "Model Y L AWD": "modely.png",
  "Model Y Long Range(2025)": "modely.png",
  "Model Y Premium Long Range": "modely.png",
  "Model Y Premium RWD": "modely.png",
  "Model Y RWD(2025)": "modely.png",

  // 폭스바겐
  "(단종)Q6 e-tron performance": "q6.png",
  "ID.4 Pro": "id4.png",
  "iD.5 Pro": "id5.png",
  "Q4 45 e-tron": "q4.png",
  "Q4 Sportback 45 e-tron": "q4.png",

  // 폴스타
  "Polestar 4 Coupe Dual Motor": "polestar4.png",
  "Polestar 4 Coupe Rear Motor": "polestar4.png",

  // 현대 / 제네시스
  "ELECTRIFIED G80": "g80.png",
  "ELECTRIFIED GV70 AWD 19인치": "gv70.png",
  "ELECTRIFIED GV70 AWD 20인치": "gv70.png",
  "GV60 스탠다드 2WD 19인치": "gv60.png",
  "GV60 스탠다드 AWD 19인치": "gv60.png",
  "GV60 스탠다드 AWD 20인치": "gv60.png",
  "더 뉴 아이오닉5 2WD 롱레인지 19인치": "ioniq5.png",
  "더 뉴 아이오닉5 2WD 롱레인지 19인치 빌트인 캠 미적용": "ioniq5.png",
  "더 뉴 아이오닉5 2WD 롱레인지 20인치": "ioniq5.png",
  "더 뉴 아이오닉5 2WD 롱레인지 N라인 20인치": "ioniq5.png",
  "더 뉴 아이오닉5 2WD 스탠다드 19인치": "ioniq5.png",
  "더 뉴 아이오닉5 AWD 롱레인지 19인치": "ioniq5.png",
  "더 뉴 아이오닉5 AWD 롱레인지 20인치": "ioniq5.png",
  "더 뉴 아이오닉5 AWD 롱레인지 N라인 20인치": "ioniq5.png",
  "더 뉴 아이오닉6 2WD 롱레인지 18인치": "ioniq6.png",
  "더 뉴 아이오닉6 2WD 롱레인지 20인치": "ioniq6.png",
  "더 뉴 아이오닉6 2WD 롱레인지 N라인 20인치": "ioniq6.png",
  "더 뉴 아이오닉6 2WD 스탠다드 18인치": "ioniq6.png",
  "더 뉴 아이오닉6 AWD 롱레인지 18인치": "ioniq6.png",
  "더 뉴 아이오닉6 AWD 롱레인지 20인치": "ioniq6.png",
  "더 뉴 아이오닉6 AWD 롱레인지 N라인 20인치": "ioniq6.png",
  "스타리아 라운지 일렉트릭 7인승": "staria.png",
  "스타리아 리무진 일렉트릭 6인승": "staria.png",
  "아이오닉6 N": "ioniq6n.png",
  "아이오닉9 성능형 AWD": "ioniq9.png",
  "아이오닉9 항속형 2WD": "ioniq9.png",
  "아이오닉9 항속형 AWD": "ioniq9.png",
  "캐스퍼 일렉트릭 기본형 15인치": "casper.png",
  "캐스퍼 일렉트릭 크로스 17인치": "casper.png",
  "캐스퍼 일렉트릭 항속형 15인치": "casper.png",
  "캐스퍼 일렉트릭 항속형 17인치(라운지포함)": "casper.png",
  "코나 일렉트릭 2WD 롱레인지 17인치": "kona.png",
  "코나 일렉트릭 2WD 롱레인지 17인치 빌트인 캠 미적용": "kona.png",
  "코나 일렉트릭 2WD 롱레인지 19인치": "kona.png",
  "코나 일렉트릭 2WD 스탠다드 17인치": "kona.png",
};

/**
 * 모델명으로 차량 이미지 경로를 반환합니다.
 * 정확한 일치 → 부분 키워드 매칭 순으로 검색하며,
 * 이미지가 없으면 null을 반환합니다.
 * @param {string} modelName - 차량 모델명 (모델명 또는 제조사+모델명)
 * @returns {string|null} 이미지 src 경로 or null
 */
export function getCarImage(modelName) {
  if (!modelName) return null;

  const name = String(modelName).trim();

  // 1) 정확한 매칭
  if (CAR_IMAGE_MAP[name]) {
    return `/car_img/${CAR_IMAGE_MAP[name]}`;
  }

  // 2) 부분 매칭 (키가 modelName에 포함되거나, modelName이 키에 포함)
  for (const [key, file] of Object.entries(CAR_IMAGE_MAP)) {
    if (name.includes(key) || key.includes(name)) {
      return `/car_img/${file}`;
    }
  }

  // 3) 소문자 키워드 기반 폴백 매칭
  const lower = name.toLowerCase().replace(/\s/g, "");
  const KEYWORD_MAP = [
    ["ev3", "ev3.png"],
    ["ev4", "ev4.png"],
    ["ev5", "ev5.png"],
    ["ev6", "ev6.png"],
    ["ev9", "ev9.png"],
    ["ioniq5", "ioniq5.png"],
    ["아이오닉5", "ioniq5.png"],
    ["ioniq6n", "ioniq6n.png"],
    ["아이오닉6n", "ioniq6n.png"],
    ["ioniq6", "ioniq6.png"],
    ["아이오닉6", "ioniq6.png"],
    ["ioniq9", "ioniq9.png"],
    ["아이오닉9", "ioniq9.png"],
    ["레이", "ray.png"],
    ["ray", "ray.png"],
    ["casper", "casper.png"],
    ["캐스퍼", "casper.png"],
    ["kona", "kona.png"],
    ["코나", "kona.png"],
    ["staria", "staria.png"],
    ["스타리아", "staria.png"],
    ["model3", "model3.png"],
    ["modely", "modely.png"],
    ["gv60", "gv60.png"],
    ["gv70", "gv70.png"],
    ["g80", "g80.png"],
    ["pv5", "pv5.png"],
    ["niro", "niro.webp"],
    ["니로", "niro.webp"],
    ["torres", "torres.png"],
    ["토레스", "torres.png"],
    ["atto", "atto.png"],
    ["dolphin", "dolphin.png"],
    ["seal", "seal.png"],
    ["sealion", "sealion.png"],
    ["id4", "id4.png"],
    ["id5", "id5.png"],
    ["q4", "q4.png"],
    ["q6", "q6.png"],
    ["polestar", "polestar4.png"],
    ["폴스타", "polestar4.png"],
    ["ex30cc", "ex30cc.png"],
    ["ex30", "ex30.png"],
    ["eqa", "eqa.png"],
    ["eqb", "eqb.png"],
    ["mini", "MINI Aceman.png"],
    ["ix1", "ix1.png"],
    ["ix2", "ix2.png"],
    ["ix3", "ix3.png"],
    ["i4", "i4.png"],
    ["i5", "i5.png"],
    ["gv70", "gv70.png"],
  ];

  for (const [kw, file] of KEYWORD_MAP) {
    if (lower.includes(kw.toLowerCase().replace(/\s/g, ""))) {
      return `/car_img/${file}`;
    }
  }

  return null;
}
