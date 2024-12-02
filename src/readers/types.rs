pub enum FileType {
    Xls,
    Pdf,
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
