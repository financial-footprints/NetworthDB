pub enum FileType {
    Xls,
    Pdf,
}

impl FileType {
    pub fn to_string(&self) -> String {
        match self {
            FileType::Xls => "xls".to_string(),
            FileType::Pdf => "pdf".to_string(),
        }
    }
}

pub struct File {
    pub file_type: FileType,
    pub data: Vec<Vec<String>>,
}
