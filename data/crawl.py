from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
from bs4 import BeautifulSoup
import pandas as pd
import time


def crawl_ev_subsidies_all():
    options = webdriver.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    url = "https://www.ev.or.kr/nportal/buySupprt/initPsLocalCarPirceAction.do"
    driver.get(url)
    time.sleep(3)

    all_data = []
    headers = []
    headers_extracted = False

    try:
        main_table_selector = "#subPage > div > div.contentList.fz13 > table > tbody > tr"
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, main_table_selector)))

        row_count = len(driver.find_elements(By.CSS_SELECTOR, main_table_selector))
        print(f"총 {row_count}개의 지역 데이터 수집을 시작합니다.\n")

        # rowspan 때문에 시도 칸이 비는 행이 있음 -> 직전 값을 이어서 사용
        last_sido = ""

        for i in range(row_count):
            main_window = driver.current_window_handle
            sido, sigungu = "", ""

            try:
                rows = driver.find_elements(By.CSS_SELECTOR, main_table_selector)
                current_row = rows[i]

                # ---- 변경 지점: 시도 / 시군구 두 칸을 모두 읽음 ----
                tds = current_row.find_elements(By.TAG_NAME, "td")

                if len(tds) >= 2:
                    c0 = tds[0].text.strip()
                    c1 = tds[1].text.strip()
                else:
                    c0 = tds[0].text.strip() if tds else ""
                    c1 = ""

                # rowspan 처리: 시도 칸이 생략된 행이면 직전 시도를 승계
                # (이 경우 tds[0]이 이미 시군구가 됨)
                cell_count = len(tds)
                if cell_count >= 4:
                    # 시도 + 지역구분 + 조회 + 보조금 → 정상 행
                    sido = c0 if c0 else last_sido
                    sigungu = c1
                    if c0:
                        last_sido = c0
                else:
                    # 시도 칸이 rowspan으로 병합되어 생략된 행
                    sido = last_sido
                    sigungu = c0

                if not sigungu:
                    sigungu = sido

                region_label = f"{sido} {sigungu}".strip()
                # ------------------------------------------------

                try:
                    btn = current_row.find_element(By.CSS_SELECTOR, "td.tr_car_btn > a")
                except NoSuchElementException:
                    print(f"[{region_label}] 조회 버튼이 없어 스킵합니다.")
                    continue

                print(f"[{region_label}] 데이터 수집 시작...")
                driver.execute_script("arguments[0].click();", btn)

                wait.until(EC.number_of_windows_to_be(2))

                for window_handle in driver.window_handles:
                    if window_handle != main_window:
                        driver.switch_to.window(window_handle)
                        break

                popup_table_selector = "body > form > div > div:nth-child(3) > table"
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, popup_table_selector)))
                time.sleep(1)

                soup = BeautifulSoup(driver.page_source, 'html.parser')
                table = soup.select_one(popup_table_selector)

                if table:
                    if not headers_extracted:
                        thead = table.find("thead")
                        if thead:
                            th_elements = thead.find_all("th")
                            # ---- 변경 지점: 컬럼 2개로 시작 ----
                            headers = ["시도", "시군구"] + [th.text.strip() for th in th_elements]
                            headers_extracted = True

                    tbody = table.find("tbody")
                    if tbody:
                        tr_elements = tbody.find_all("tr")
                        for tr in tr_elements:
                            tds_p = tr.find_all("td")
                            # ---- 변경 지점: 시도/시군구 둘 다 붙임 ----
                            row_data = [sido, sigungu] + [td.text.strip() for td in tds_p]
                            all_data.append(row_data)
                        print(f"  -> [{region_label}] {len(tr_elements)}건 수집 성공!")

                driver.close()
                driver.switch_to.window(main_window)
                time.sleep(1)

            except Exception as inner_e:
                print(f"  -> [{region_label}] 수집 중 오류 (스킵): {inner_e}")
                if len(driver.window_handles) > 1:
                    for handle in driver.window_handles:
                        if handle != main_window:
                            driver.switch_to.window(handle)
                            driver.close()
                    driver.switch_to.window(main_window)
                continue

    except Exception as e:
        print(f"전체 프로세스 오류: {e}")
    finally:
        driver.quit()

    if all_data:
        df = pd.DataFrame(all_data, columns=headers if headers else None)

        # 한국환경공단 자체 물량 행 제거 (일반 구매자와 무관)
        before = len(df)
        df = df[~df["시도"].str.contains("공단", na=False)]
        df = df[~df["시군구"].str.contains("공단", na=False)]
        if before != len(df):
            print(f"'공단' 행 {before - len(df)}건 제외")

        csv_filename = "ev_subsidy_data_sigungu.csv"
        df.to_csv(csv_filename, index=False, encoding="utf-8-sig")
        print(f"\n총 {len(df)}건 저장 완료 → '{csv_filename}'")
        print(f"시도 {df['시도'].nunique()}개 / 시군구 {df['시군구'].nunique()}개")
        print()
        print(df.head(10).to_string())
    else:
        print("\n수집된 데이터가 없습니다.")


if __name__ == "__main__":
    crawl_ev_subsidies_all()