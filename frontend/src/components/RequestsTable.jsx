import React from 'react'

const RequestsTable = ({ requests }) => {
  if (requests.length === 0) {
    return (
      <div className="requests-table" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>📝 Нет загруженных заявок</h3>
        <p>Загрузите файл, чтобы увидеть данные</p>
      </div>
    )
  }

  return (
    <div className="requests-table">
      <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
        <h3>📋 Загруженные заявки</h3>
        <p>Всего записей: {requests.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Дата заявки</th>
            <th>Марка</th>
            <th>Гос.номер</th>
            <th>Наименование</th>
            <th>Артикул</th>
            <th>Кол-во</th>
            <th>Согласовано</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request, index) => (
            <tr key={index}>
              <td>{request.request_number}</td>
              <td>{request.request_date}</td>
              <td>{request.car_brand}</td>
              <td>{request.license_plate}</td>
              <td>{request.item_name}</td>
              <td>{request.article}</td>
              <td>{request.quantity}</td>
              <td>{request.approved ? 'Да' : 'Нет'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RequestsTable
