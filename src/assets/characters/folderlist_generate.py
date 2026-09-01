import os

def create_folder_list():
    # 1. 현재 파이썬 스크립트가 위치한 경로를 가져옵니다.
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 2. 해당 경로에 있는 모든 파일과 폴더 목록을 가져온 뒤, 폴더인 것만 걸러냅니다.
    folders = [
        name for name in os.listdir(current_dir) 
        if os.path.isdir(os.path.join(current_dir, name))
    ]
    
    # 3. 결과를 저장할 텍스트 파일의 경로를 지정합니다.
    output_file = os.path.join(current_dir, "folder_list.txt")
    
    # 4. 텍스트 파일을 쓰기 모드('w')로 열고 폴더 이름들을 기록합니다.
    # 한글 폴더명이 깨지지 않도록 encoding='utf-8'을 지정합니다.
    with open(output_file, 'w', encoding='utf-8') as f:
        for folder in folders:
            f.write(f"{folder}\n")
            
    print(f"완료되었습니다! '{output_file}' 파일이 생성되었습니다.")

if __name__ == "__main__":
    create_folder_list()