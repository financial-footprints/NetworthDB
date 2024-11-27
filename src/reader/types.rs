pub enum FileType {
    Xls,
    Pdf,
}

impl FileType {
    pub fn to_string(&self) -> String {
        match self {
            FileType::Xls => String::from("xls"),
            FileType::Pdf => String::from("pdf"),
        }
    }
}

pub struct File {
    pub file_type: FileType,
    pub data: FileData,
}

#[derive(Debug)]
pub enum FileData {
    Text(String),
    Table(Vec<Vec<String>>),
}
